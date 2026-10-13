-- =====================================================================
-- Fatijardins — Fase 1: base
-- Equipa (colaboradores, equipas, custos, ausências), clientes e locais.
-- Todas as tabelas têm Row Level Security ativa; as permissões por
-- perfil (gerente / chefe_equipa / colaborador) são aplicadas aqui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Esquema privado para funções auxiliares (não exposto na Data API)
-- ---------------------------------------------------------------------
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.perfil_utilizador as enum ('gerente', 'chefe_equipa', 'colaborador');
create type public.tipo_ausencia as enum ('ferias', 'doenca', 'formacao', 'falta', 'outro');

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function app.definir_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Equipas
-- ---------------------------------------------------------------------
create table public.equipas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cor text not null default '#15803d' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  chefe_id uuid,
  ativa boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipas_nome_unico unique (nome)
);

comment on table public.equipas is 'Equipas de campo; cada equipa tem um chefe (colaborador).';
comment on column public.equipas.cor is 'Cor usada no calendário (hex #rrggbb).';

-- ---------------------------------------------------------------------
-- Colaboradores (ligados a auth.users quando têm acesso à app)
-- ---------------------------------------------------------------------
create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nome text not null check (length(trim(nome)) > 0),
  funcao text,
  perfil public.perfil_utilizador not null default 'colaborador',
  telemovel text,
  email text,
  equipa_id uuid references public.equipas (id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.colaboradores is 'Pessoas da empresa. user_id liga à conta de acesso (auth.users).';
comment on column public.colaboradores.perfil is 'gerente: acesso total; chefe_equipa: gere a sua equipa; colaborador: só o seu trabalho.';

create index colaboradores_equipa_id_idx on public.colaboradores (equipa_id);

alter table public.equipas
  add constraint equipas_chefe_id_fkey
  foreign key (chefe_id) references public.colaboradores (id) on delete set null;

create index equipas_chefe_id_idx on public.equipas (chefe_id);

-- Custo/hora fica numa tabela à parte para que só o gerente o possa ler
-- (a RLS trabalha por linha, não por coluna).
create table public.colaboradores_custos (
  colaborador_id uuid primary key references public.colaboradores (id) on delete cascade,
  custo_hora numeric(10, 2) not null default 0 check (custo_hora >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.colaboradores_custos is 'Custo/hora de cada colaborador. Só o gerente tem acesso.';

-- ---------------------------------------------------------------------
-- Ausências (férias, baixas, formações…)
-- ---------------------------------------------------------------------
create table public.ausencias (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id) on delete cascade,
  tipo public.tipo_ausencia not null default 'ferias',
  data_inicio date not null,
  data_fim date not null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ausencias_datas_validas check (data_fim >= data_inicio)
);

create index ausencias_colaborador_datas_idx on public.ausencias (colaborador_id, data_inicio, data_fim);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  nif text check (nif ~ '^[0-9]{9}$'),
  pessoa_contacto text,
  telemovel text,
  telefone text,
  email text,
  morada text,
  codigo_postal text check (codigo_postal ~ '^[0-9]{4}-[0-9]{3}$'),
  localidade text,
  notas text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.clientes.morada is 'Morada de faturação.';

create unique index clientes_nif_unico on public.clientes (nif) where nif is not null;
create index clientes_nome_idx on public.clientes (lower(nome));

-- ---------------------------------------------------------------------
-- Locais / jardins de cada cliente
-- ---------------------------------------------------------------------
create table public.locais (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  morada text not null check (length(trim(morada)) > 0),
  codigo_postal text check (codigo_postal ~ '^[0-9]{4}-[0-9]{3}$'),
  localidade text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  area_m2 numeric(10, 2) check (area_m2 >= 0),
  notas text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locais_coordenadas_completas check ((latitude is null) = (longitude is null))
);

comment on table public.locais is 'Moradas/jardins onde se trabalha; um cliente pode ter vários.';
comment on column public.locais.notas is 'Notas para a equipa: acesso, chaves, rega, animais…';

create index locais_cliente_id_idx on public.locais (cliente_id);

-- ---------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------
create trigger equipas_updated_at before update on public.equipas
  for each row execute function app.definir_updated_at();
create trigger colaboradores_updated_at before update on public.colaboradores
  for each row execute function app.definir_updated_at();
create trigger colaboradores_custos_updated_at before update on public.colaboradores_custos
  for each row execute function app.definir_updated_at();
create trigger ausencias_updated_at before update on public.ausencias
  for each row execute function app.definir_updated_at();
create trigger clientes_updated_at before update on public.clientes
  for each row execute function app.definir_updated_at();
create trigger locais_updated_at before update on public.locais
  for each row execute function app.definir_updated_at();

-- ---------------------------------------------------------------------
-- Funções de permissões (security definer: leem colaboradores sem RLS)
-- ---------------------------------------------------------------------
create or replace function app.colaborador_atual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.colaboradores c
  where c.user_id = (select auth.uid()) and c.ativo;
$$;

create or replace function app.perfil_atual()
returns public.perfil_utilizador
language sql
stable
security definer
set search_path = ''
as $$
  select c.perfil
  from public.colaboradores c
  where c.user_id = (select auth.uid()) and c.ativo;
$$;

create or replace function app.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.perfil_atual() is not null;
$$;

create or replace function app.e_gerente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.perfil_atual() = 'gerente', false);
$$;

create or replace function app.e_gerente_ou_chefe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.perfil_atual() in ('gerente', 'chefe_equipa'), false);
$$;

-- Equipas que o utilizador atual chefia.
create or replace function app.equipas_chefiadas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.equipas e
  where e.chefe_id = app.colaborador_atual();
$$;

-- ---------------------------------------------------------------------
-- Tem de existir sempre pelo menos um gerente ativo
-- ---------------------------------------------------------------------
create or replace function app.garantir_gerente_ativo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.colaboradores where perfil = 'gerente' and ativo
  ) then
    raise exception 'Tem de existir pelo menos um gerente ativo.'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create trigger colaboradores_gerente_ativo
  after update or delete on public.colaboradores
  for each statement execute function app.garantir_gerente_ativo();

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.equipas enable row level security;
alter table public.colaboradores enable row level security;
alter table public.colaboradores_custos enable row level security;
alter table public.ausencias enable row level security;
alter table public.clientes enable row level security;
alter table public.locais enable row level security;

-- Equipas: todos os utilizadores ativos veem; só o gerente altera.
create policy "equipas: ver" on public.equipas
  for select to authenticated using ((select app.tem_acesso()));
create policy "equipas: criar (gerente)" on public.equipas
  for insert to authenticated with check ((select app.e_gerente()));
create policy "equipas: alterar (gerente)" on public.equipas
  for update to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));
create policy "equipas: apagar (gerente)" on public.equipas
  for delete to authenticated using ((select app.e_gerente()));

-- Colaboradores: lista da equipa visível a todos os utilizadores ativos;
-- só o gerente cria, altera ou apaga.
create policy "colaboradores: ver" on public.colaboradores
  for select to authenticated using ((select app.tem_acesso()));
create policy "colaboradores: criar (gerente)" on public.colaboradores
  for insert to authenticated with check ((select app.e_gerente()));
create policy "colaboradores: alterar (gerente)" on public.colaboradores
  for update to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));
create policy "colaboradores: apagar (gerente)" on public.colaboradores
  for delete to authenticated using ((select app.e_gerente()));

-- Custos/hora: só o gerente.
create policy "custos: tudo (gerente)" on public.colaboradores_custos
  for all to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));

-- Ausências: gerente vê e gere todas; chefe vê as da sua equipa;
-- cada colaborador vê as suas.
create policy "ausencias: ver" on public.ausencias
  for select to authenticated using (
    (select app.e_gerente())
    or colaborador_id = (select app.colaborador_atual())
    or exists (
      select 1
      from public.colaboradores c
      where c.id = ausencias.colaborador_id
        and c.equipa_id in (select app.equipas_chefiadas())
    )
  );
create policy "ausencias: criar (gerente)" on public.ausencias
  for insert to authenticated with check ((select app.e_gerente()));
create policy "ausencias: alterar (gerente)" on public.ausencias
  for update to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));
create policy "ausencias: apagar (gerente)" on public.ausencias
  for delete to authenticated using ((select app.e_gerente()));

-- Clientes e locais: gerente e chefes de equipa veem, criam e alteram
-- (os chefes registam visitas a clientes novos); só o gerente apaga.
-- Os colaboradores passam a ver os clientes/locais dos seus trabalhos
-- na fase 2.
create policy "clientes: ver (gerente/chefe)" on public.clientes
  for select to authenticated using ((select app.e_gerente_ou_chefe()));
create policy "clientes: criar (gerente/chefe)" on public.clientes
  for insert to authenticated with check ((select app.e_gerente_ou_chefe()));
create policy "clientes: alterar (gerente/chefe)" on public.clientes
  for update to authenticated using ((select app.e_gerente_ou_chefe())) with check ((select app.e_gerente_ou_chefe()));
create policy "clientes: apagar (gerente)" on public.clientes
  for delete to authenticated using ((select app.e_gerente()));

create policy "locais: ver (gerente/chefe)" on public.locais
  for select to authenticated using ((select app.e_gerente_ou_chefe()));
create policy "locais: criar (gerente/chefe)" on public.locais
  for insert to authenticated with check ((select app.e_gerente_ou_chefe()));
create policy "locais: alterar (gerente/chefe)" on public.locais
  for update to authenticated using ((select app.e_gerente_ou_chefe())) with check ((select app.e_gerente_ou_chefe()));
create policy "locais: apagar (gerente)" on public.locais
  for delete to authenticated using ((select app.e_gerente()));

-- ---------------------------------------------------------------------
-- Grants para a Data API (o acesso real é decidido pela RLS acima).
-- O papel anon (sem sessão) não tem acesso a nenhuma tabela, e nenhum
-- papel da API recebe TRUNCATE (que ignoraria a RLS).
-- ---------------------------------------------------------------------
revoke all on public.equipas, public.colaboradores, public.colaboradores_custos,
  public.ausencias, public.clientes, public.locais from anon, authenticated;

grant select, insert, update, delete on public.equipas, public.colaboradores,
  public.colaboradores_custos, public.ausencias, public.clientes, public.locais
  to authenticated, service_role;
