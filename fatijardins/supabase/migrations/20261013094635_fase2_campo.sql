-- =====================================================================
-- Fatijardins — Fase 2: Campo
-- Agenda de trabalhos, registo diário (tarefas, materiais, fotos,
-- assinatura) e picagem de horas. RLS ativa em todas as tabelas novas.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.tipo_trabalho as enum ('manutencao', 'obra');
create type public.origem_trabalho as enum ('avulso', 'contrato', 'orcamento');
create type public.estado_trabalho as enum ('agendado', 'em_curso', 'concluido', 'cancelado');
create type public.momento_foto as enum ('antes', 'depois', 'outra');
create type public.origem_registo_horas as enum ('picagem', 'manual');

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

-- Data de hoje no fuso de Lisboa.
create or replace function app.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Lisbon')::date;
$$;

-- Equipa do utilizador atual (como membro).
create or replace function app.minha_equipa()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.equipa_id
  from public.colaboradores c
  where c.user_id = (select auth.uid()) and c.ativo;
$$;

-- ---------------------------------------------------------------------
-- Trabalhos (agendamentos)
-- ---------------------------------------------------------------------
create table public.trabalhos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais (id) on delete restrict,
  -- Preenchido automaticamente a partir do local (trigger), para relatórios por cliente.
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  tipo public.tipo_trabalho not null default 'manutencao',
  origem public.origem_trabalho not null default 'avulso',
  data date not null,
  hora_inicio time,
  duracao_prevista_min integer check (duracao_prevista_min between 1 and 1440),
  equipa_id uuid references public.equipas (id) on delete set null,
  ordem integer not null default 0,
  estado public.estado_trabalho not null default 'agendado',
  -- Trabalhos recorrentes criados de uma vez partilham o mesmo serie_id.
  serie_id uuid,
  criado_por uuid default app.colaborador_atual() references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.trabalhos is 'Trabalhos agendados (um por dia e local). Base da agenda, do "O meu dia" e das rotas.';
comment on column public.trabalhos.descricao is 'Tarefas previstas.';
comment on column public.trabalhos.ordem is 'Ordem de passagem no dia, dentro da equipa (rotas).';
comment on column public.trabalhos.serie_id is 'Agrupa os trabalhos criados por uma repetição (semanal, quinzenal, mensal).';

create index trabalhos_data_equipa_idx on public.trabalhos (data, equipa_id, ordem);
create index trabalhos_local_id_idx on public.trabalhos (local_id);
create index trabalhos_cliente_id_idx on public.trabalhos (cliente_id);
create index trabalhos_serie_id_idx on public.trabalhos (serie_id) where serie_id is not null;
create index trabalhos_criado_por_idx on public.trabalhos (criado_por);

create trigger trabalhos_updated_at before update on public.trabalhos
  for each row execute function app.definir_updated_at();

-- O cliente vem sempre do local escolhido.
create or replace function app.trabalho_cliente_do_local()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select l.cliente_id into new.cliente_id from public.locais l where l.id = new.local_id;
  return new;
end;
$$;

create trigger trabalhos_cliente_do_local
  before insert or update of local_id, cliente_id on public.trabalhos
  for each row execute function app.trabalho_cliente_do_local();

-- O colaborador só pode mudar o estado (iniciar / concluir) dos seus trabalhos.
create or replace function app.restringir_alteracoes_trabalho()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.perfil_atual() = 'colaborador' then
    if (new.local_id, new.cliente_id, new.titulo, new.descricao, new.tipo, new.origem, new.data,
        new.hora_inicio, new.duracao_prevista_min, new.equipa_id, new.ordem, new.serie_id, new.criado_por)
       is distinct from
       (old.local_id, old.cliente_id, old.titulo, old.descricao, old.tipo, old.origem, old.data,
        old.hora_inicio, old.duracao_prevista_min, old.equipa_id, old.ordem, old.serie_id, old.criado_por)
    then
      raise exception 'Só pode alterar o estado do trabalho.' using errcode = 'insufficient_privilege';
    end if;
    if new.estado is distinct from old.estado and new.estado not in ('em_curso', 'concluido') then
      raise exception 'Só pode iniciar ou concluir trabalhos.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger trabalhos_restringir_colaborador
  before update on public.trabalhos
  for each row execute function app.restringir_alteracoes_trabalho();

-- ---------------------------------------------------------------------
-- Registo diário de cada trabalho
-- ---------------------------------------------------------------------
create table public.registos_trabalho (
  id uuid primary key default gen_random_uuid(),
  trabalho_id uuid not null unique references public.trabalhos (id) on delete restrict,
  tarefas_feitas text,
  notas text,
  assinatura_caminho text,
  assinatura_nome text,
  assinado_em timestamptz,
  colaborador_id uuid default app.colaborador_atual() references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registos_assinatura_completa check ((assinatura_caminho is null) = (assinado_em is null))
);

comment on table public.registos_trabalho is 'O que foi feito no local: tarefas, notas e assinatura opcional do cliente.';
comment on column public.registos_trabalho.colaborador_id is 'Quem fez a última alteração.';
comment on column public.registos_trabalho.assinatura_caminho is 'Imagem da assinatura no Storage (bucket fotos).';

create index registos_trabalho_colaborador_id_idx on public.registos_trabalho (colaborador_id);

create trigger registos_trabalho_updated_at before update on public.registos_trabalho
  for each row execute function app.definir_updated_at();

create table public.registo_materiais (
  id uuid primary key default gen_random_uuid(),
  registo_id uuid not null references public.registos_trabalho (id) on delete cascade,
  descricao text not null check (length(trim(descricao)) > 0),
  quantidade numeric(10, 2) not null check (quantidade > 0),
  unidade text not null default 'un' check (length(trim(unidade)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.registo_materiais is 'Materiais gastos num trabalho. Na fase 4 passam a ligar-se aos consumíveis e ao stock.';

create index registo_materiais_registo_id_idx on public.registo_materiais (registo_id);

create trigger registo_materiais_updated_at before update on public.registo_materiais
  for each row execute function app.definir_updated_at();

-- ---------------------------------------------------------------------
-- Fotos (antes/depois). A fase 3 acrescenta visita_id.
-- ---------------------------------------------------------------------
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  trabalho_id uuid references public.trabalhos (id) on delete restrict,
  momento public.momento_foto not null default 'outra',
  caminho text not null unique,
  legenda text,
  largura integer check (largura > 0),
  altura integer check (altura > 0),
  tamanho_bytes integer check (tamanho_bytes > 0),
  colaborador_id uuid default app.colaborador_atual() references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fotos_um_dono check (num_nonnulls(trabalho_id) = 1)
);

comment on table public.fotos is 'Fotos guardadas no Storage (bucket fotos). Polimórfica: trabalho (fase 2), visita (fase 3).';

create index fotos_trabalho_id_idx on public.fotos (trabalho_id);
create index fotos_colaborador_id_idx on public.fotos (colaborador_id);

-- ---------------------------------------------------------------------
-- Registos de horas (picagem)
-- ---------------------------------------------------------------------
create table public.registos_horas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id) on delete cascade,
  trabalho_id uuid references public.trabalhos (id) on delete set null,
  entrada timestamptz not null,
  saida timestamptz,
  entrada_latitude numeric(9, 6) check (entrada_latitude between -90 and 90),
  entrada_longitude numeric(9, 6) check (entrada_longitude between -180 and 180),
  saida_latitude numeric(9, 6) check (saida_latitude between -90 and 90),
  saida_longitude numeric(9, 6) check (saida_longitude between -180 and 180),
  origem public.origem_registo_horas not null default 'manual',
  a_rever boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registos_horas_saida_depois check (saida is null or saida > entrada),
  -- A mesma pessoa não pode ter dois períodos sobrepostos.
  constraint registos_horas_sem_sobreposicao exclude using gist (
    colaborador_id with =,
    tstzrange(entrada, coalesce(saida, 'infinity'::timestamptz)) with &&
  )
);

comment on table public.registos_horas is 'Períodos de trabalho (entrada/saída), por picagem no telemóvel ou introduzidos pelo gerente.';
comment on column public.registos_horas.a_rever is 'Saída não registada (fechada automaticamente às 23:59) ou outra situação a confirmar pelo gerente.';

create unique index registos_horas_uma_aberta on public.registos_horas (colaborador_id) where saida is null;
create index registos_horas_colaborador_entrada_idx on public.registos_horas (colaborador_id, entrada);
create index registos_horas_trabalho_id_idx on public.registos_horas (trabalho_id);

create trigger registos_horas_updated_at before update on public.registos_horas
  for each row execute function app.definir_updated_at();

-- ---------------------------------------------------------------------
-- Funções de visibilidade usadas pelas políticas
-- ---------------------------------------------------------------------

-- Clientes e locais dos trabalhos de hoje do colaborador.
create or replace function app.clientes_dos_meus_trabalhos()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.cliente_id
  from public.trabalhos t
  where app.perfil_atual() = 'colaborador'
    and t.equipa_id = app.minha_equipa()
    and t.data = app.hoje();
$$;

create or replace function app.locais_dos_meus_trabalhos()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.local_id
  from public.trabalhos t
  where app.perfil_atual() = 'colaborador'
    and t.equipa_id = app.minha_equipa()
    and t.data = app.hoje();
$$;

-- "trabalhos/<uuid>/ficheiro.jpg" → uuid (ou null se o caminho não seguir o formato).
create or replace function app.trabalho_do_caminho(caminho text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when caminho ~ '^trabalhos/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[^/]+$'
    then split_part(caminho, '/', 2)::uuid
  end;
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Picagem: funções chamadas pela app (hora do servidor, nunca do telemóvel)
-- ---------------------------------------------------------------------

-- Fecha às 23:59:59 (Lisboa) uma entrada esquecida de um dia anterior e
-- marca-a para o gerente rever. Devolve o registo fechado (ou null).
create or replace function app.fechar_entrada_esquecida(p_colaborador uuid)
returns public.registos_horas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registo public.registos_horas;
begin
  update public.registos_horas r
  set saida = greatest(
        r.entrada + interval '1 second',
        (((r.entrada at time zone 'Europe/Lisbon')::date + 1)::timestamp at time zone 'Europe/Lisbon') - interval '1 second'
      ),
      a_rever = true,
      notas = trim(coalesce(r.notas, '') || ' Saída não registada: fechada automaticamente no fim do dia.')
  where r.colaborador_id = p_colaborador
    and r.saida is null
    and (r.entrada at time zone 'Europe/Lisbon')::date < app.hoje()
  returning r.* into v_registo;
  return v_registo;
end;
$$;

create or replace function public.picar_entrada(
  p_trabalho_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.registos_horas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colaborador uuid := app.colaborador_atual();
  v_agora timestamptz := now();
  v_registo public.registos_horas;
begin
  if v_colaborador is null then
    raise exception 'Sem acesso à app.' using errcode = 'insufficient_privilege';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Localização incompleta.' using errcode = 'check_violation';
  end if;

  if p_trabalho_id is not null and not exists (
    select 1
    from public.trabalhos t
    where t.id = p_trabalho_id
      and t.data = app.hoje()
      and t.estado <> 'cancelado'
      and (
        app.e_gerente()
        or t.equipa_id = app.minha_equipa()
        or t.equipa_id in (select app.equipas_chefiadas())
      )
  ) then
    raise exception 'Este trabalho não é de hoje ou não pertence à sua equipa.' using errcode = 'insufficient_privilege';
  end if;

  perform app.fechar_entrada_esquecida(v_colaborador);

  -- Mudar de trabalho: fecha o período em curso e abre outro.
  update public.registos_horas
  set saida = v_agora, saida_latitude = p_latitude, saida_longitude = p_longitude
  where colaborador_id = v_colaborador and saida is null and entrada < v_agora;

  insert into public.registos_horas
    (colaborador_id, trabalho_id, entrada, entrada_latitude, entrada_longitude, origem)
  values
    (v_colaborador, p_trabalho_id, v_agora, p_latitude, p_longitude, 'picagem')
  returning * into v_registo;

  if p_trabalho_id is not null then
    update public.trabalhos set estado = 'em_curso' where id = p_trabalho_id and estado = 'agendado';
  end if;

  return v_registo;
end;
$$;

create or replace function public.picar_saida(
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.registos_horas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colaborador uuid := app.colaborador_atual();
  v_registo public.registos_horas;
begin
  if v_colaborador is null then
    raise exception 'Sem acesso à app.' using errcode = 'insufficient_privilege';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Localização incompleta.' using errcode = 'check_violation';
  end if;

  -- Entrada de hoje: fecha agora.
  update public.registos_horas
  set saida = greatest(now(), entrada + interval '1 second'),
      saida_latitude = p_latitude,
      saida_longitude = p_longitude
  where colaborador_id = v_colaborador
    and saida is null
    and (entrada at time zone 'Europe/Lisbon')::date = app.hoje()
  returning * into v_registo;

  -- Entrada esquecida de outro dia: fecha no fim desse dia e marca "a rever"
  -- (a app avisa a pessoa através de a_rever = true).
  if v_registo.id is null then
    v_registo := app.fechar_entrada_esquecida(v_colaborador);
  end if;

  if v_registo.id is null then
    raise exception 'Não tem nenhuma entrada aberta.' using errcode = 'no_data_found';
  end if;

  return v_registo;
end;
$$;

revoke all on function public.picar_entrada(uuid, numeric, numeric) from public, anon;
revoke all on function public.picar_saida(numeric, numeric) from public, anon;
grant execute on function public.picar_entrada(uuid, numeric, numeric) to authenticated, service_role;
grant execute on function public.picar_saida(numeric, numeric) to authenticated, service_role;
revoke all on function app.fechar_entrada_esquecida(uuid) from public, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.trabalhos enable row level security;
alter table public.registos_trabalho enable row level security;
alter table public.registo_materiais enable row level security;
alter table public.fotos enable row level security;
alter table public.registos_horas enable row level security;

-- Trabalhos: gerente tudo; chefe as equipas que chefia; colaborador os
-- da sua equipa de hoje (e só muda o estado — ver trigger).
create policy "trabalhos: ver" on public.trabalhos
  for select to authenticated using (
    (select app.e_gerente())
    or equipa_id in (select app.equipas_chefiadas())
    or (
      (select app.perfil_atual()) = 'colaborador'
      and equipa_id = (select app.minha_equipa())
      and data = (select app.hoje())
    )
  );
create policy "trabalhos: criar" on public.trabalhos
  for insert to authenticated with check (
    (select app.e_gerente())
    or equipa_id in (select app.equipas_chefiadas())
  );
create policy "trabalhos: alterar" on public.trabalhos
  for update to authenticated
  using (
    (select app.e_gerente())
    or equipa_id in (select app.equipas_chefiadas())
    or (
      (select app.perfil_atual()) = 'colaborador'
      and equipa_id = (select app.minha_equipa())
      and data = (select app.hoje())
    )
  )
  with check (
    (select app.e_gerente())
    or equipa_id in (select app.equipas_chefiadas())
    or (
      (select app.perfil_atual()) = 'colaborador'
      and equipa_id = (select app.minha_equipa())
      and data = (select app.hoje())
    )
  );
create policy "trabalhos: apagar" on public.trabalhos
  for delete to authenticated using (
    (select app.e_gerente())
    or (equipa_id in (select app.equipas_chefiadas()) and estado = 'agendado')
  );

-- Registos, materiais e fotos seguem a visibilidade do trabalho.
create policy "registos: ver" on public.registos_trabalho
  for select to authenticated using (
    exists (select 1 from public.trabalhos t where t.id = registos_trabalho.trabalho_id)
  );
create policy "registos: criar" on public.registos_trabalho
  for insert to authenticated with check (
    exists (select 1 from public.trabalhos t where t.id = registos_trabalho.trabalho_id)
  );
create policy "registos: alterar" on public.registos_trabalho
  for update to authenticated
  using (exists (select 1 from public.trabalhos t where t.id = registos_trabalho.trabalho_id))
  with check (exists (select 1 from public.trabalhos t where t.id = registos_trabalho.trabalho_id));
create policy "registos: apagar (gerente)" on public.registos_trabalho
  for delete to authenticated using ((select app.e_gerente()));

create policy "materiais: ver" on public.registo_materiais
  for select to authenticated using (
    exists (select 1 from public.registos_trabalho r where r.id = registo_materiais.registo_id)
  );
create policy "materiais: criar" on public.registo_materiais
  for insert to authenticated with check (
    exists (select 1 from public.registos_trabalho r where r.id = registo_materiais.registo_id)
  );
create policy "materiais: alterar" on public.registo_materiais
  for update to authenticated
  using (exists (select 1 from public.registos_trabalho r where r.id = registo_materiais.registo_id))
  with check (exists (select 1 from public.registos_trabalho r where r.id = registo_materiais.registo_id));
create policy "materiais: apagar" on public.registo_materiais
  for delete to authenticated using (
    exists (select 1 from public.registos_trabalho r where r.id = registo_materiais.registo_id)
  );

create policy "fotos: ver" on public.fotos
  for select to authenticated using (
    exists (select 1 from public.trabalhos t where t.id = fotos.trabalho_id)
  );
create policy "fotos: criar" on public.fotos
  for insert to authenticated with check (
    colaborador_id = (select app.colaborador_atual())
    and exists (select 1 from public.trabalhos t where t.id = fotos.trabalho_id)
  );
create policy "fotos: alterar legenda" on public.fotos
  for update to authenticated
  using (
    exists (select 1 from public.trabalhos t where t.id = fotos.trabalho_id)
    and ((select app.e_gerente_ou_chefe()) or colaborador_id = (select app.colaborador_atual()))
  )
  with check (exists (select 1 from public.trabalhos t where t.id = fotos.trabalho_id));
create policy "fotos: apagar" on public.fotos
  for delete to authenticated using (
    exists (select 1 from public.trabalhos t where t.id = fotos.trabalho_id)
    and ((select app.e_gerente_ou_chefe()) or colaborador_id = (select app.colaborador_atual()))
  );

-- Horas: cada um vê as suas, o chefe as da equipa, o gerente todas.
-- Picar é feito pelas funções picar_entrada/picar_saida; à mão só o gerente.
create policy "horas: ver" on public.registos_horas
  for select to authenticated using (
    (select app.e_gerente())
    or colaborador_id = (select app.colaborador_atual())
    or exists (
      select 1
      from public.colaboradores c
      where c.id = registos_horas.colaborador_id
        and c.equipa_id in (select app.equipas_chefiadas())
    )
  );
create policy "horas: criar (gerente)" on public.registos_horas
  for insert to authenticated with check ((select app.e_gerente()));
create policy "horas: alterar (gerente)" on public.registos_horas
  for update to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));
create policy "horas: apagar (gerente)" on public.registos_horas
  for delete to authenticated using ((select app.e_gerente()));

-- O colaborador passa a ver os clientes e locais dos seus trabalhos de hoje.
create policy "clientes: ver (trabalhos de hoje do colaborador)" on public.clientes
  for select to authenticated using (id in (select app.clientes_dos_meus_trabalhos()));
create policy "locais: ver (trabalhos de hoje do colaborador)" on public.locais
  for select to authenticated using (id in (select app.locais_dos_meus_trabalhos()));

-- ---------------------------------------------------------------------
-- Grants para a Data API (o acesso real é decidido pela RLS).
-- ---------------------------------------------------------------------
revoke all on public.trabalhos, public.registos_trabalho, public.registo_materiais,
  public.fotos, public.registos_horas from anon, authenticated;
grant select, insert, update, delete on public.trabalhos, public.registos_trabalho,
  public.registo_materiais, public.fotos, public.registos_horas to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Storage: bucket privado "fotos" (fotos dos trabalhos e assinaturas)
-- Caminhos: trabalhos/<trabalho_id>/<ficheiro>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "fotos (storage): ver" on storage.objects
  for select to authenticated using (
    bucket_id = 'fotos'
    and exists (select 1 from public.trabalhos t where t.id = app.trabalho_do_caminho(name))
  );
create policy "fotos (storage): enviar" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fotos'
    and (select app.tem_acesso())
    and exists (select 1 from public.trabalhos t where t.id = app.trabalho_do_caminho(name))
  );
create policy "fotos (storage): apagar" on storage.objects
  for delete to authenticated using (
    bucket_id = 'fotos'
    and exists (select 1 from public.trabalhos t where t.id = app.trabalho_do_caminho(name))
    and ((select app.e_gerente_ou_chefe()) or owner_id = (select auth.uid())::text)
  );
