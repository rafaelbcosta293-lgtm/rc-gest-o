-- =====================================================================
-- Fatijardins — Fase 3: Orçamentos
-- Visitas (com fotos, medidas e notas), orçamentos com linhas, dados da
-- empresa para o PDF e conversão do orçamento aceite em trabalho.
-- Gerente: tudo. Chefe de equipa: visitas e rascunhos de orçamento.
-- Colaborador: sem acesso (não vê valores). RLS ativa em todas as tabelas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.estado_orcamento as enum ('rascunho', 'enviado', 'aceite', 'recusado');
create type public.tipo_linha_orcamento as enum ('mao_de_obra', 'material', 'equipamento', 'outros');

-- ---------------------------------------------------------------------
-- Empresa (uma só linha): dados que aparecem no PDF do orçamento
-- ---------------------------------------------------------------------
create table public.empresa (
  id boolean primary key default true check (id),
  nome text not null default 'Fatijardins' check (length(trim(nome)) > 0),
  nif text check (nif ~ '^[0-9]{9}$'),
  morada text,
  codigo_postal text check (codigo_postal ~ '^[0-9]{4}-[0-9]{3}$'),
  localidade text,
  telefone text,
  email text,
  website text,
  iban text,
  validade_orcamento_dias integer not null default 30 check (validade_orcamento_dias between 1 and 365),
  condicoes_orcamento text,
  updated_at timestamptz not null default now()
);

comment on table public.empresa is 'Dados da empresa (uma só linha) usados no PDF dos orçamentos.';
comment on column public.empresa.validade_orcamento_dias is 'Validade proposta para os orçamentos novos.';
comment on column public.empresa.condicoes_orcamento is 'Condições propostas para os orçamentos novos (pagamento, prazos…).';

insert into public.empresa (id, condicoes_orcamento) values (
  true,
  'Pagamento: 50% na adjudicação e 50% na conclusão dos trabalhos.' || chr(10) ||
  'Aos valores indicados acresce o IVA à taxa legal em vigor, discriminado neste orçamento.'
);

create trigger empresa_updated_at before update on public.empresa
  for each row execute function app.definir_updated_at();

-- ---------------------------------------------------------------------
-- Visitas (para orçamentar)
-- ---------------------------------------------------------------------
create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais (id) on delete restrict,
  -- Preenchido automaticamente a partir do local (trigger).
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  data date not null,
  hora time,
  responsavel_id uuid default app.colaborador_atual() references public.colaboradores (id) on delete set null,
  medidas text,
  area_m2 numeric(10, 2) check (area_m2 > 0),
  notas text,
  criado_por uuid references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.visitas is 'Visitas ao local do cliente para preparar um orçamento (fotos, medidas e notas).';
comment on column public.visitas.medidas is 'Medidas em texto livre (ex.: relvado 120 m², sebe 35 m).';

create index visitas_data_idx on public.visitas (data);
create index visitas_local_id_idx on public.visitas (local_id);
create index visitas_cliente_id_idx on public.visitas (cliente_id);
create index visitas_responsavel_id_idx on public.visitas (responsavel_id);
create index visitas_criado_por_idx on public.visitas (criado_por);

create trigger visitas_updated_at before update on public.visitas
  for each row execute function app.definir_updated_at();

-- O cliente vem sempre do local (a função da fase 2 serve para qualquer
-- tabela com local_id e cliente_id).
create trigger visitas_cliente_do_local
  before insert or update of local_id, cliente_id on public.visitas
  for each row execute function app.trabalho_cliente_do_local();

-- Quem cria é sempre o utilizador da sessão (pedidos sem sessão, como a
-- seed, mantêm o valor indicado).
create or replace function app.definir_criado_por()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(app.colaborador_atual(), new.criado_por);
  else
    new.criado_por := old.criado_por;
  end if;
  return new;
end;
$$;

create trigger visitas_criado_por
  before insert or update on public.visitas
  for each row execute function app.definir_criado_por();

-- ---------------------------------------------------------------------
-- Orçamentos
-- ---------------------------------------------------------------------
create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  -- Número sequencial por ano (ex.: 2026/0001), atribuído pela BD.
  ano integer not null,
  numero integer not null,
  local_id uuid not null references public.locais (id) on delete restrict,
  -- Preenchido automaticamente a partir do local (trigger).
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  visita_id uuid references public.visitas (id) on delete set null,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  data date not null default app.hoje(),
  validade date not null,
  estado public.estado_orcamento not null default 'rascunho',
  condicoes text,
  notas_internas text,
  -- Totais calculados pela BD a partir das linhas.
  subtotal numeric(12, 2) not null default 0,
  total_iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  enviado_em timestamptz,
  respondido_em timestamptz,
  trabalho_id uuid unique references public.trabalhos (id) on delete set null,
  criado_por uuid references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamentos_numero_unico unique (ano, numero),
  constraint orcamentos_validade check (validade >= data)
);

comment on table public.orcamentos is 'Orçamentos (rascunho → enviado → aceite/recusado). O aceite converte-se em trabalho.';
comment on column public.orcamentos.descricao is 'Texto de apresentação/âmbito que aparece no PDF.';
comment on column public.orcamentos.notas_internas is 'Notas só para a empresa (não aparecem no PDF).';
comment on column public.orcamentos.respondido_em is 'Quando o cliente aceitou ou recusou.';
comment on column public.orcamentos.trabalho_id is 'Trabalho criado a partir deste orçamento (converter_orcamento).';

create index orcamentos_estado_idx on public.orcamentos (estado, data desc);
create index orcamentos_local_id_idx on public.orcamentos (local_id);
create index orcamentos_cliente_id_idx on public.orcamentos (cliente_id);
create index orcamentos_visita_id_idx on public.orcamentos (visita_id);
create index orcamentos_criado_por_idx on public.orcamentos (criado_por);

create trigger orcamentos_updated_at before update on public.orcamentos
  for each row execute function app.definir_updated_at();

create trigger orcamentos_cliente_do_local
  before insert or update of local_id, cliente_id on public.orcamentos
  for each row execute function app.trabalho_cliente_do_local();

create trigger orcamentos_criado_por
  before insert or update on public.orcamentos
  for each row execute function app.definir_criado_por();

-- Número do orçamento: o seguinte do ano da data. Sem validade indicada,
-- usa a validade proposta nos dados da empresa.
create or replace function app.numerar_orcamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.validade := coalesce(
    new.validade,
    new.data + coalesce((select e.validade_orcamento_dias from public.empresa e), 30)
  );
  new.ano := extract(year from new.data)::integer;
  -- Um orçamento de cada vez por ano, para não haver números repetidos.
  perform pg_advisory_xact_lock(hashtext('orcamentos'), new.ano);
  select coalesce(max(o.numero), 0) + 1 into new.numero from public.orcamentos o where o.ano = new.ano;
  return new;
end;
$$;

create trigger orcamentos_numerar
  before insert on public.orcamentos
  for each row execute function app.numerar_orcamento();

-- Regras dos estados (para todos; quem pode mudar o quê está na RLS):
-- - só o rascunho se altera; depois de enviado só muda o estado (e as notas internas);
-- - rascunho → enviado (com pelo menos uma linha) → aceite | recusado | rascunho;
--   recusado → rascunho; aceite → enviado só enquanto não houver trabalho;
-- - o número, o ano e as datas de envio/resposta são definidos aqui.
create or replace function app.regras_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'rascunho' then
      raise exception 'Um orçamento novo começa sempre em rascunho.' using errcode = 'check_violation';
    end if;
    new.enviado_em := null;
    new.respondido_em := null;
    new.trabalho_id := null;
    return new;
  end if;

  if new.ano is distinct from old.ano or new.numero is distinct from old.numero then
    raise exception 'O número do orçamento não se altera.' using errcode = 'check_violation';
  end if;

  if old.estado <> 'rascunho' and (
    new.local_id, new.cliente_id, new.visita_id, new.titulo, new.descricao, new.data, new.validade, new.condicoes
  ) is distinct from (
    old.local_id, old.cliente_id, old.visita_id, old.titulo, old.descricao, old.data, old.validade, old.condicoes
  ) then
    raise exception 'Só um orçamento em rascunho pode ser alterado. Volte a pô-lo em rascunho primeiro.'
      using errcode = 'check_violation';
  end if;

  if new.data is distinct from old.data and extract(year from new.data)::integer <> old.ano then
    raise exception 'A data do orçamento tem de ficar no mesmo ano do número (%).', old.ano
      using errcode = 'check_violation';
  end if;

  if new.estado is distinct from old.estado then
    if not (
      (old.estado = 'rascunho' and new.estado = 'enviado')
      or (old.estado = 'enviado' and new.estado in ('rascunho', 'aceite', 'recusado'))
      or (old.estado = 'recusado' and new.estado = 'rascunho')
      or (old.estado = 'aceite' and new.estado = 'enviado' and old.trabalho_id is null)
    ) then
      raise exception 'Não é possível passar o orçamento de % para %.', old.estado, new.estado
        using errcode = 'check_violation';
    end if;
    if new.estado = 'enviado' and not exists (
      select 1 from public.orcamento_linhas l where l.orcamento_id = new.id
    ) then
      raise exception 'O orçamento não tem linhas: acrescente pelo menos uma antes de o enviar.'
        using errcode = 'check_violation';
    end if;
    new.enviado_em := case
      when new.estado = 'rascunho' then null
      when new.estado = 'enviado' and old.estado = 'rascunho' then now()
      else old.enviado_em
    end;
    new.respondido_em := case when new.estado in ('aceite', 'recusado') then now() else null end;
  else
    new.enviado_em := old.enviado_em;
    new.respondido_em := old.respondido_em;
  end if;

  return new;
end;
$$;

create trigger orcamentos_regras
  before insert or update on public.orcamentos
  for each row execute function app.regras_orcamento();

-- ---------------------------------------------------------------------
-- Linhas do orçamento
-- ---------------------------------------------------------------------
create table public.orcamento_linhas (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  ordem integer not null default 0,
  tipo public.tipo_linha_orcamento not null default 'mao_de_obra',
  descricao text not null check (length(trim(descricao)) > 0),
  quantidade numeric(12, 3) not null check (quantidade > 0 and quantidade <= 1000000),
  unidade text not null default 'un' check (length(trim(unidade)) > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0 and preco_unitario <= 10000000),
  taxa_iva numeric(5, 2) not null default 23 check (taxa_iva in (0, 6, 13, 23)),
  total numeric(14, 2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orcamento_linhas is 'Linhas do orçamento (mão de obra, material, equipamento, outros).';
comment on column public.orcamento_linhas.total is 'Quantidade × preço unitário, sem IVA, arredondado ao cêntimo.';
comment on column public.orcamento_linhas.taxa_iva is 'Taxa de IVA em % (Continente: 23, 13, 6 ou 0 — isento).';

create index orcamento_linhas_orcamento_idx on public.orcamento_linhas (orcamento_id, ordem);

create trigger orcamento_linhas_updated_at before update on public.orcamento_linhas
  for each row execute function app.definir_updated_at();

-- Totais do orçamento: subtotal (sem IVA), IVA por taxa (arredondado por
-- taxa, como numa fatura) e total.
create or replace function app.recalcular_totais_orcamento(p_orcamento uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orcamentos o
  set subtotal = t.subtotal,
      total_iva = t.iva,
      total = t.subtotal + t.iva
  from (
    select coalesce(sum(g.base), 0) as subtotal,
           coalesce(sum(round(g.base * g.taxa / 100, 2)), 0) as iva
    from (
      select l.taxa_iva as taxa, sum(l.total) as base
      from public.orcamento_linhas l
      where l.orcamento_id = p_orcamento
      group by l.taxa_iva
    ) g
  ) t
  where o.id = p_orcamento
    and (o.subtotal, o.total_iva, o.total) is distinct from (t.subtotal, t.iva, t.subtotal + t.iva);
$$;

create or replace function app.linhas_mudaram()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform app.recalcular_totais_orcamento(old.orcamento_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.orcamento_id <> old.orcamento_id) then
    perform app.recalcular_totais_orcamento(new.orcamento_id);
  end if;
  return null;
end;
$$;

create trigger orcamento_linhas_totais
  after insert or update or delete on public.orcamento_linhas
  for each row execute function app.linhas_mudaram();

-- ---------------------------------------------------------------------
-- Trabalhos: de que orçamento vieram
-- ---------------------------------------------------------------------
alter table public.trabalhos
  add column orcamento_id uuid references public.orcamentos (id) on delete set null;

comment on column public.trabalhos.orcamento_id is 'Orçamento que deu origem a este trabalho (origem = orcamento).';

create index trabalhos_orcamento_id_idx on public.trabalhos (orcamento_id) where orcamento_id is not null;

-- Converte um orçamento aceite num trabalho (um clique). Só o gerente.
-- p_ordem: lugar no dia da equipa (a app calcula-o pela hora; null = no fim).
create or replace function public.converter_orcamento(
  p_orcamento_id uuid,
  p_data date,
  p_equipa_id uuid default null,
  p_tipo public.tipo_trabalho default 'obra',
  p_hora time default null,
  p_ordem integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos;
  v_descricao text;
  v_trabalho uuid;
begin
  if not app.e_gerente() then
    raise exception 'Só o gerente pode converter orçamentos em trabalhos.' using errcode = 'insufficient_privilege';
  end if;
  if p_data is null then
    raise exception 'Indique o dia do trabalho.' using errcode = 'check_violation';
  end if;

  select * into v_orcamento from public.orcamentos where id = p_orcamento_id for update;
  if v_orcamento.id is null then
    raise exception 'O orçamento não existe.' using errcode = 'no_data_found';
  end if;
  if v_orcamento.estado <> 'aceite' then
    raise exception 'Só um orçamento aceite pode ser convertido em trabalho.' using errcode = 'check_violation';
  end if;
  if v_orcamento.trabalho_id is not null then
    raise exception 'Este orçamento já foi convertido em trabalho.' using errcode = 'check_violation';
  end if;

  -- Tarefas previstas: a descrição do orçamento e as linhas de mão de obra.
  select concat_ws(
    chr(10),
    nullif(trim(v_orcamento.descricao), ''),
    string_agg('• ' || l.descricao, chr(10) order by l.ordem, l.created_at)
  )
  into v_descricao
  from public.orcamento_linhas l
  where l.orcamento_id = v_orcamento.id and l.tipo = 'mao_de_obra';

  insert into public.trabalhos (
    local_id, cliente_id, titulo, descricao, tipo, origem, orcamento_id, data, hora_inicio, equipa_id, ordem
  )
  values (
    v_orcamento.local_id, v_orcamento.cliente_id, v_orcamento.titulo, nullif(v_descricao, ''), p_tipo, 'orcamento',
    v_orcamento.id, p_data, p_hora, p_equipa_id,
    coalesce(
      p_ordem,
      (select coalesce(max(t.ordem), 0) + 1 from public.trabalhos t
       where t.data = p_data and t.equipa_id is not distinct from p_equipa_id)
    )
  )
  returning id into v_trabalho;

  update public.orcamentos set trabalho_id = v_trabalho where id = v_orcamento.id;
  return v_trabalho;
end;
$$;

-- ---------------------------------------------------------------------
-- Fotos de visitas (a tabela fotos é polimórfica: trabalho ou visita)
-- Caminhos: visitas/<visita_id>/<ficheiro>
-- ---------------------------------------------------------------------
create or replace function app.visita_do_caminho(caminho text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when caminho ~ '^visitas/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[^/]+$'
    then split_part(caminho, '/', 2)::uuid
  end;
$$;

alter table public.fotos add column visita_id uuid references public.visitas (id) on delete restrict;
alter table public.fotos drop constraint fotos_um_dono;
alter table public.fotos add constraint fotos_um_dono check (num_nonnulls(trabalho_id, visita_id) = 1);
alter table public.fotos
  add constraint fotos_caminho_da_visita
  check (
    visita_id is null
    or (coalesce(app.visita_do_caminho(caminho) = visita_id, false) and position('..' in caminho) = 0)
  );

create index fotos_visita_id_idx on public.fotos (visita_id) where visita_id is not null;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.empresa enable row level security;
alter table public.visitas enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_linhas enable row level security;

create policy "empresa: ver" on public.empresa
  for select to authenticated using ((select app.e_gerente_ou_chefe()));
create policy "empresa: alterar (gerente)" on public.empresa
  for update to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));

-- Visitas: gerente e chefes veem, criam e alteram; apaga o gerente ou quem a criou.
create policy "visitas: ver" on public.visitas
  for select to authenticated using ((select app.e_gerente_ou_chefe()));
create policy "visitas: criar" on public.visitas
  for insert to authenticated with check ((select app.e_gerente_ou_chefe()));
create policy "visitas: alterar" on public.visitas
  for update to authenticated
  using ((select app.e_gerente_ou_chefe()))
  with check ((select app.e_gerente_ou_chefe()));
create policy "visitas: apagar" on public.visitas
  for delete to authenticated using (
    (select app.e_gerente())
    or ((select app.e_gerente_ou_chefe()) and criado_por = (select app.colaborador_atual()))
  );

-- Orçamentos: gerente tudo; o chefe vê todos e cria/altera rascunhos (não
-- os envia nem marca como aceites/recusados); apaga o gerente (rascunhos e
-- recusados) ou o chefe que criou o rascunho.
create policy "orcamentos: ver" on public.orcamentos
  for select to authenticated using ((select app.e_gerente_ou_chefe()));
create policy "orcamentos: criar" on public.orcamentos
  for insert to authenticated with check ((select app.e_gerente_ou_chefe()) and estado = 'rascunho');
create policy "orcamentos: alterar" on public.orcamentos
  for update to authenticated
  using ((select app.e_gerente()) or ((select app.e_gerente_ou_chefe()) and estado = 'rascunho'))
  with check ((select app.e_gerente()) or ((select app.e_gerente_ou_chefe()) and estado = 'rascunho'));
create policy "orcamentos: apagar" on public.orcamentos
  for delete to authenticated using (
    ((select app.e_gerente()) and estado in ('rascunho', 'recusado'))
    or (
      (select app.e_gerente_ou_chefe())
      and estado = 'rascunho'
      and criado_por = (select app.colaborador_atual())
    )
  );

-- Linhas: veem-se com o orçamento; só se mexem enquanto está em rascunho.
create policy "linhas: ver" on public.orcamento_linhas
  for select to authenticated using (
    exists (select 1 from public.orcamentos o where o.id = orcamento_linhas.orcamento_id)
  );
create policy "linhas: criar" on public.orcamento_linhas
  for insert to authenticated with check (
    (select app.e_gerente_ou_chefe())
    and exists (select 1 from public.orcamentos o where o.id = orcamento_linhas.orcamento_id and o.estado = 'rascunho')
  );
create policy "linhas: alterar" on public.orcamento_linhas
  for update to authenticated
  using (
    (select app.e_gerente_ou_chefe())
    and exists (select 1 from public.orcamentos o where o.id = orcamento_linhas.orcamento_id and o.estado = 'rascunho')
  )
  with check (
    (select app.e_gerente_ou_chefe())
    and exists (select 1 from public.orcamentos o where o.id = orcamento_linhas.orcamento_id and o.estado = 'rascunho')
  );
create policy "linhas: apagar" on public.orcamento_linhas
  for delete to authenticated using (
    (select app.e_gerente_ou_chefe())
    and exists (select 1 from public.orcamentos o where o.id = orcamento_linhas.orcamento_id and o.estado = 'rascunho')
  );

-- Fotos de visitas: seguem a visibilidade da visita (gerente e chefes).
create policy "fotos de visitas: ver" on public.fotos
  for select to authenticated using (
    exists (select 1 from public.visitas v where v.id = fotos.visita_id)
  );
create policy "fotos de visitas: criar" on public.fotos
  for insert to authenticated with check (
    colaborador_id = (select app.colaborador_atual())
    and exists (select 1 from public.visitas v where v.id = fotos.visita_id)
  );
create policy "fotos de visitas: alterar legenda" on public.fotos
  for update to authenticated
  using (exists (select 1 from public.visitas v where v.id = fotos.visita_id))
  with check (exists (select 1 from public.visitas v where v.id = fotos.visita_id));
create policy "fotos de visitas: apagar" on public.fotos
  for delete to authenticated using (
    exists (select 1 from public.visitas v where v.id = fotos.visita_id)
  );

-- ---------------------------------------------------------------------
-- Grants para a Data API (o acesso real é decidido pela RLS). Nos
-- orçamentos, o número, os totais, as datas de envio/resposta e o
-- trabalho só são escritos pela BD.
-- ---------------------------------------------------------------------
revoke all on public.empresa, public.visitas, public.orcamentos, public.orcamento_linhas from anon, authenticated;

grant select on public.empresa to authenticated;
grant update (nome, nif, morada, codigo_postal, localidade, telefone, email, website, iban,
  validade_orcamento_dias, condicoes_orcamento) on public.empresa to authenticated;

grant select, insert, update, delete on public.visitas to authenticated;

grant select, delete on public.orcamentos to authenticated;
grant insert (local_id, visita_id, titulo, descricao, data, validade, condicoes, notas_internas)
  on public.orcamentos to authenticated;
grant update (local_id, visita_id, titulo, descricao, data, validade, estado, condicoes, notas_internas)
  on public.orcamentos to authenticated;

grant select, delete on public.orcamento_linhas to authenticated;
grant insert (orcamento_id, ordem, tipo, descricao, quantidade, unidade, preco_unitario, taxa_iva)
  on public.orcamento_linhas to authenticated;
grant update (ordem, tipo, descricao, quantidade, unidade, preco_unitario, taxa_iva)
  on public.orcamento_linhas to authenticated;

grant all on public.empresa, public.visitas, public.orcamentos, public.orcamento_linhas to service_role;

revoke all on function public.converter_orcamento(uuid, date, uuid, public.tipo_trabalho, time, integer) from public, anon;
grant execute on function public.converter_orcamento(uuid, date, uuid, public.tipo_trabalho, time, integer)
  to authenticated, service_role;

revoke all on function app.definir_criado_por() from public;
revoke all on function app.numerar_orcamento() from public;
revoke all on function app.regras_orcamento() from public;
revoke all on function app.recalcular_totais_orcamento(uuid) from public;
revoke all on function app.linhas_mudaram() from public;
revoke all on function app.visita_do_caminho(text) from public;
grant execute on function app.definir_criado_por(), app.numerar_orcamento(), app.regras_orcamento(),
  app.linhas_mudaram(), app.visita_do_caminho(text) to authenticated, service_role;
grant execute on function app.recalcular_totais_orcamento(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Storage: fotos das visitas no mesmo bucket privado "fotos"
-- ---------------------------------------------------------------------
create policy "fotos de visitas (storage): ver" on storage.objects
  for select to authenticated using (
    bucket_id = 'fotos'
    and exists (select 1 from public.visitas v where v.id = app.visita_do_caminho(name))
  );
create policy "fotos de visitas (storage): enviar" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fotos'
    and exists (select 1 from public.visitas v where v.id = app.visita_do_caminho(name))
  );
create policy "fotos de visitas (storage): apagar" on storage.objects
  for delete to authenticated using (
    bucket_id = 'fotos'
    and exists (select 1 from public.visitas v where v.id = app.visita_do_caminho(name))
  );
