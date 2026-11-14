-- Mapa de Férias Anual + Registos de Horários & Assiduidade.
-- Tudo por perfil (instrutor), não por estúdio: o estúdio de cada um
-- (config_assiduidade) só decide o feriado municipal e o limite de
-- instrutores de férias em simultâneo.

create type estado_pedido_ferias as enum ('Pendente', 'Aprovado', 'Recusado');
create type estado_fecho_horario as enum ('Rascunho', 'Submetido', 'Aprovado');

-- 1. Configuração contratual de cada instrutor
create table public.config_assiduidade (
  perfil_id uuid primary key references public.perfis(id) on delete cascade,
  estudio_id smallint not null references public.estudios(id),
  horas_diarias numeric(4,2) not null default 8 check (horas_diarias > 0 and horas_diarias <= 24),
  tipo_contrato text not null default 'contrato' check (tipo_contrato in ('contrato', 'recibos_verdes')),
  atualizado_em timestamptz not null default now()
);

-- 2. Períodos em que não se pode marcar férias (definidos pela gestão)
create table public.ferias_bloqueios (
  id uuid primary key default gen_random_uuid(),
  inicio date not null,
  fim date not null,
  estudio_id smallint references public.estudios(id), -- null = todos os estúdios
  motivo text not null check (length(trim(motivo)) > 0),
  criado_por uuid references public.perfis(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);

-- 3. Pedidos de férias
create table public.pedidos_ferias (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  estudio_id smallint not null references public.estudios(id),
  ano int not null,
  dias date[] not null check (cardinality(dias) > 0),
  dias_uteis int not null check (dias_uteis >= 0),
  estado estado_pedido_ferias not null default 'Pendente',
  motivo_recusa text,
  revisto_por uuid references public.perfis(id),
  revisto_em timestamptz,
  aviso_visto_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pedidos_ferias_perfil_ano_idx on public.pedidos_ferias (perfil_id, ano);
create index pedidos_ferias_estudio_estado_idx on public.pedidos_ferias (estudio_id, estado);
create index pedidos_ferias_dias_idx on public.pedidos_ferias using gin (dias);

-- 4. Registo diário de entrada e saída (1 ou 2 turnos)
create table public.registos_horario (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  data date not null,
  entrada_1 time,
  saida_1 time,
  entrada_2 time,
  saida_2 time,
  horas numeric(5,2) generated always as (
    round((coalesce(extract(epoch from (saida_1 - entrada_1)), 0)
         + coalesce(extract(epoch from (saida_2 - entrada_2)), 0)) / 3600.0, 2)
  ) stored,
  nota text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (perfil_id, data),
  check ((entrada_1 is null) = (saida_1 is null)),
  check ((entrada_2 is null) = (saida_2 is null)),
  check (entrada_1 is not null or entrada_2 is not null),
  check (saida_1 is null or saida_1 > entrada_1),
  check (saida_2 is null or saida_2 > entrada_2),
  check (saida_1 is null or entrada_2 is null or entrada_2 >= saida_1)
);

-- 5. Fecho mensal de cada instrutor
create table public.fechos_horario (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  dias_uteis int not null,
  dias_trabalhados int not null default 0,
  dias_ferias int not null default 0,
  datas_ferias date[] not null default '{}',
  faltas int not null default 0,
  horas_diarias numeric(4,2) not null,
  horas_esperadas numeric(6,2) not null,
  horas_realizadas numeric(6,2) not null default 0,
  horas_extra numeric(6,2) not null default 0,
  saldo numeric(6,2) not null default 0,
  estado estado_fecho_horario not null default 'Rascunho',
  submetido_em timestamptz,
  aprovado_por uuid references public.perfis(id),
  aprovado_em timestamptz,
  unique (perfil_id, ano, mes)
);

-- RLS
alter table public.config_assiduidade enable row level security;
alter table public.ferias_bloqueios enable row level security;
alter table public.pedidos_ferias enable row level security;
alter table public.registos_horario enable row level security;
alter table public.fechos_horario enable row level security;

create policy ler_config_assiduidade on public.config_assiduidade for select
  using (perfil_id = (select auth.uid()) or e_gestao());
create policy gerir_config_assiduidade on public.config_assiduidade for all
  using (e_gestao()) with check (e_gestao());

create policy ler_ferias_bloqueios on public.ferias_bloqueios for select
  using ((select auth.uid()) is not null);
create policy gerir_ferias_bloqueios on public.ferias_bloqueios for all
  using (e_gestao()) with check (e_gestao());

-- O mapa de férias é visível para toda a equipa (para saber quem está fora).
create policy ler_pedidos_ferias on public.pedidos_ferias for select
  using (exists (select 1 from public.perfis where id = (select auth.uid())));
create policy criar_pedidos_ferias on public.pedidos_ferias for insert
  with check ((perfil_id = (select auth.uid()) and estado = 'Pendente') or e_gestao());
create policy editar_pedidos_ferias on public.pedidos_ferias for update
  using (perfil_id = (select auth.uid()) or e_gestao())
  with check (perfil_id = (select auth.uid()) or e_gestao());
create policy apagar_pedidos_ferias on public.pedidos_ferias for delete
  using ((perfil_id = (select auth.uid()) and estado = 'Pendente') or e_gestao());

create policy ler_registos_horario on public.registos_horario for select
  using (perfil_id = (select auth.uid()) or e_gestao());
create policy gerir_registos_horario on public.registos_horario for all
  using (perfil_id = (select auth.uid()) or e_gestao())
  with check (perfil_id = (select auth.uid()) or e_gestao());

create policy ler_fechos_horario on public.fechos_horario for select
  using (perfil_id = (select auth.uid()) or e_gestao());
create policy criar_fechos_horario on public.fechos_horario for insert
  with check ((perfil_id = (select auth.uid()) and estado in ('Rascunho', 'Submetido')) or e_gestao());
create policy editar_fechos_horario on public.fechos_horario for update
  using (perfil_id = (select auth.uid()) or e_gestao())
  with check (perfil_id = (select auth.uid()) or e_gestao());

-- Quem não é gestão: num pedido de férias só pode marcar o aviso como
-- visto; num fecho só pode passar de Rascunho a Submetido (depois fica
-- bloqueado até a gestão o reabrir).
create or replace function public.restringir_pedidos_ferias()
returns trigger language plpgsql set search_path = public as $$
begin
  if e_gestao() then
    new.atualizado_em := now();
    return new;
  end if;
  if new.perfil_id is distinct from old.perfil_id or new.estudio_id is distinct from old.estudio_id
    or new.ano is distinct from old.ano or new.dias is distinct from old.dias
    or new.dias_uteis is distinct from old.dias_uteis or new.estado is distinct from old.estado
    or new.motivo_recusa is distinct from old.motivo_recusa or new.revisto_por is distinct from old.revisto_por
    or new.revisto_em is distinct from old.revisto_em then
    raise exception 'Só a gestão pode alterar um pedido de férias.';
  end if;
  return new;
end;
$$;
create trigger trg_restringir_pedidos_ferias before update on public.pedidos_ferias
  for each row execute function public.restringir_pedidos_ferias();

create or replace function public.restringir_fechos_horario()
returns trigger language plpgsql set search_path = public as $$
begin
  if e_gestao() then
    return new;
  end if;
  if old.estado <> 'Rascunho' then
    raise exception 'Este mês já foi submetido — só a gestão o pode reabrir.';
  end if;
  if new.estado not in ('Rascunho', 'Submetido') or new.aprovado_por is not null or new.aprovado_em is not null
    or new.perfil_id is distinct from old.perfil_id or new.ano is distinct from old.ano or new.mes is distinct from old.mes then
    raise exception 'Alteração não permitida neste fecho.';
  end if;
  return new;
end;
$$;
create trigger trg_restringir_fechos_horario before update on public.fechos_horario
  for each row execute function public.restringir_fechos_horario();

-- Um mês submetido fica fechado aos registos do próprio instrutor.
create or replace function public.bloquear_registos_mes_fechado()
returns trigger language plpgsql set search_path = public as $$
begin
  if not e_gestao() then
    if (tg_op <> 'DELETE' and exists (
          select 1 from public.fechos_horario f
          where f.perfil_id = new.perfil_id and f.estado <> 'Rascunho'
            and f.ano = extract(year from new.data)::int and f.mes = extract(month from new.data)::int))
       or (tg_op <> 'INSERT' and exists (
          select 1 from public.fechos_horario f
          where f.perfil_id = old.perfil_id and f.estado <> 'Rascunho'
            and f.ano = extract(year from old.data)::int and f.mes = extract(month from old.data)::int)) then
      raise exception 'Este mês já foi submetido — só a gestão o pode reabrir.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger trg_bloquear_registos_mes_fechado before insert or update or delete on public.registos_horario
  for each row execute function public.bloquear_registos_mes_fechado();

create index fechos_horario_ano_mes_idx on public.fechos_horario (ano, mes);
