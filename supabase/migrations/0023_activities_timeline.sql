-- Timeline unificada: uma linha por interação com uma lead ou cliente.
-- Os módulos existentes continuam a escrever nas suas tabelas próprias
-- (pagamentos, presenças, avaliações...) como sempre — triggers
-- replicam um resumo aqui, para a ficha da lead/cliente mostrar tudo
-- junto sem reescrever esses módulos.
--
-- Regra de ouro: "metadados" nunca inclui valores em € em eventos
-- visíveis a toda a equipa (ex.: Pagamento nunca grava "valor", só
-- o método e uma referência ao pagamento — quem precisar do valor
-- real já tem acesso direto à tabela "pagamentos", admin-only).
create type tipo_atividade as enum (
  'Chamada', 'WhatsApp', 'SMS', 'Email', 'Nota',
  'Experimental agendada', 'Experimental realizada', 'Experimental falhada',
  'Venda', 'Pagamento',
  'Treino realizado', 'Falta', 'Desmarcação',
  'Avaliação', 'Alteração de plano',
  'Suspensão', 'Cancelamento', 'Reativação',
  'Aniversário enviado'
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  lead_id uuid references public.leads(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  tipo tipo_atividade not null,
  descricao text,
  metadados jsonb not null default '{}'::jsonb,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now(),
  constraint activities_lead_ou_cliente check (lead_id is not null or cliente_id is not null)
);

create index activities_lead_idx on public.activities (lead_id, criado_em desc);
create index activities_cliente_idx on public.activities (cliente_id, criado_em desc);
create index activities_estudio_idx on public.activities (estudio_id, criado_em desc);

alter table public.activities enable row level security;

create policy "gerir_activities" on public.activities
  for all
  using (tenho_estudio(estudio_id))
  with check (tenho_estudio(estudio_id));

grant select, insert, update, delete on public.activities to authenticated;

-- Pagamentos: nunca grava "valor", só o método e o id do pagamento
-- (quem tiver de ver o valor consulta "pagamentos" diretamente, que já
-- é admin-only).
create or replace function public.atividade_de_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estudio smallint;
begin
  select estudio_id into v_estudio from clientes where id = new.cliente_id;
  if v_estudio is not null then
    insert into activities (estudio_id, cliente_id, tipo, descricao, metadados, criado_por)
    values (
      v_estudio, new.cliente_id, 'Pagamento', 'Pagamento registado',
      jsonb_build_object('pagamento_id', new.id, 'metodo', new.metodo, 'valido_ate', new.valido_ate),
      coalesce(new.registado_por, auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger trg_atividade_pagamento
after insert on public.pagamentos
for each row execute function public.atividade_de_pagamento();

-- Presenças: realizado/falta/desmarcação, consoante o estado.
create or replace function public.atividade_de_presenca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estudio smallint;
  v_tipo tipo_atividade;
begin
  select estudio_id into v_estudio from clientes where id = new.cliente_id;
  v_tipo := case new.estado
    when 'Presente' then 'Treino realizado'
    when 'Remarcado' then 'Desmarcação'
    else 'Falta'
  end;
  if v_estudio is not null then
    insert into activities (estudio_id, cliente_id, tipo, descricao, metadados, criado_por)
    values (
      v_estudio, new.cliente_id, v_tipo, new.estado,
      jsonb_build_object('presenca_id', new.id, 'data', new.data, 'origem', new.origem),
      coalesce(new.pt_id, auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger trg_atividade_presenca
after insert on public.presencas
for each row execute function public.atividade_de_presenca();

-- Avaliações físicas.
create or replace function public.atividade_de_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estudio smallint;
begin
  select estudio_id into v_estudio from clientes where id = new.cliente_id;
  if v_estudio is not null then
    insert into activities (estudio_id, cliente_id, tipo, descricao, metadados, criado_por)
    values (
      v_estudio, new.cliente_id, 'Avaliação', 'Avaliação física registada',
      jsonb_build_object('avaliacao_id', new.id, 'data', new.data),
      coalesce(new.pt_id, auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger trg_atividade_avaliacao
after insert on public.avaliacoes
for each row execute function public.atividade_de_avaliacao();

-- Aniversário enviado.
create or replace function public.atividade_de_aniversario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estudio smallint;
begin
  select estudio_id into v_estudio from clientes where id = new.cliente_id;
  if v_estudio is not null then
    insert into activities (estudio_id, cliente_id, tipo, descricao, metadados, criado_por)
    values (
      v_estudio, new.cliente_id, 'Aniversário enviado', 'Parabéns enviados',
      jsonb_build_object('ano', new.ano),
      coalesce(new.enviado_por, auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger trg_atividade_aniversario
after insert on public.envios_aniversario
for each row execute function public.atividade_de_aniversario();

-- Clientes: suspensão / reativação / cancelamento, só quando o estado
-- muda de facto.
create or replace function public.atividade_de_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo tipo_atividade;
begin
  if (tg_op = 'UPDATE' and new.estado is distinct from old.estado) then
    v_tipo := case
      when new.estado = 'Suspenso' then 'Suspensão'
      when new.estado = 'Ex-cliente' then 'Cancelamento'
      when old.estado = 'Suspenso' and new.estado = 'Ativo' then 'Reativação'
      else null
    end;
    if v_tipo is not null then
      insert into activities (estudio_id, cliente_id, tipo, descricao, criado_por)
      values (new.estudio_id, new.id, v_tipo, old.estado || ' → ' || new.estado, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_atividade_cliente
after update on public.clientes
for each row execute function public.atividade_de_cliente();

-- Leads: só as transições "visíveis" (as restantes já ficam todas em
-- lead_stage_history, isto é só para a timeline não ficar poluída).
create or replace function public.atividade_de_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo tipo_atividade;
begin
  if (tg_op = 'UPDATE' and new.estado is distinct from old.estado) then
    v_tipo := case new.estado
      when 'Experimental agendada' then 'Experimental agendada'
      when 'Experimental realizada' then 'Experimental realizada'
      when 'Falhou a experimental' then 'Experimental falhada'
      when 'Ganha' then 'Venda'
      else null
    end;
    if v_tipo is not null then
      insert into activities (estudio_id, lead_id, tipo, descricao, criado_por)
      values (new.estudio_id, new.id, v_tipo, new.estado, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_atividade_lead
after update on public.leads
for each row execute function public.atividade_de_lead();
