-- =====================================================================
-- Fatijardins — Fase 4: Recursos
-- Equipamentos (inventário, estado, atribuição, alertas de revisão,
-- seguro e IPO) e as suas manutenções; consumíveis com stock mínimo,
-- movimentos de stock e ligação aos materiais gastos nos trabalhos.
-- Valores (custos de manutenção, preços dos consumíveis, movimentos com
-- preço) só o gerente vê. RLS ativa em todas as tabelas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.tipo_equipamento as enum ('viatura', 'maquina', 'ferramenta', 'outro');
create type public.estado_equipamento as enum ('operacional', 'avariado', 'em_reparacao', 'abatido');
create type public.tipo_manutencao as enum ('revisao', 'reparacao', 'ipo', 'seguro', 'outra');
create type public.tipo_movimento_stock as enum ('entrada', 'saida', 'ajuste');

-- ---------------------------------------------------------------------
-- Equipamentos
-- ---------------------------------------------------------------------
create table public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  tipo public.tipo_equipamento not null default 'maquina',
  marca text,
  modelo text,
  numero_serie text,
  -- Matrículas portuguesas: três pares separados por hífen (ex.: AA-12-BC).
  matricula text unique check (matricula ~ '^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$'),
  estado public.estado_equipamento not null default 'operacional',
  -- Atribuição: a uma equipa e/ou a uma pessoa (ambas opcionais).
  equipa_id uuid references public.equipas (id) on delete set null,
  colaborador_id uuid references public.colaboradores (id) on delete set null,
  data_aquisicao date,
  proxima_revisao date,
  seguro_ate date,
  ipo_ate date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipamentos is 'Inventário de viaturas, máquinas e ferramentas, com estado, atribuição e datas para alertas.';
comment on column public.equipamentos.ipo_ate is 'Inspeção periódica obrigatória (viaturas) válida até.';

create index equipamentos_equipa_id_idx on public.equipamentos (equipa_id);
create index equipamentos_colaborador_id_idx on public.equipamentos (colaborador_id);

create trigger equipamentos_updated_at before update on public.equipamentos
  for each row execute function app.definir_updated_at();

-- O chefe só muda o estado (avariado, em reparação, operacional) e as notas
-- dos equipamentos da sua equipa ou sem equipa; abater é do gerente.
create or replace function app.restringir_alteracoes_equipamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.perfil_atual() = 'chefe_equipa' then
    if (to_jsonb(new) - 'estado' - 'notas' - 'updated_at') is distinct from (to_jsonb(old) - 'estado' - 'notas' - 'updated_at') then
      raise exception 'O chefe de equipa só pode mudar o estado e as notas do equipamento.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.estado is distinct from old.estado and 'abatido' in (new.estado, old.estado) then
      raise exception 'Só o gerente pode abater um equipamento (ou voltar a pô-lo ao serviço).'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger equipamentos_restringir_chefe
  before update on public.equipamentos
  for each row execute function app.restringir_alteracoes_equipamento();

-- ---------------------------------------------------------------------
-- Manutenções dos equipamentos (só o gerente: têm custos)
-- ---------------------------------------------------------------------
create table public.manutencoes_equipamento (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references public.equipamentos (id) on delete cascade,
  data date not null default app.hoje(),
  tipo public.tipo_manutencao not null default 'revisao',
  descricao text,
  custo numeric(10, 2) check (custo >= 0),
  -- Quilómetros (viaturas) ou horas de trabalho (máquinas) na altura.
  contador numeric(10, 1) check (contador >= 0),
  colaborador_id uuid default app.colaborador_atual() references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.manutencoes_equipamento is 'Revisões, reparações, IPO e seguros de cada equipamento. Só o gerente tem acesso.';

create index manutencoes_equipamento_idx on public.manutencoes_equipamento (equipamento_id, data desc);
create index manutencoes_colaborador_id_idx on public.manutencoes_equipamento (colaborador_id);

create trigger manutencoes_equipamento_updated_at before update on public.manutencoes_equipamento
  for each row execute function app.definir_updated_at();

-- ---------------------------------------------------------------------
-- Consumíveis (artigos) e os seus preços (só o gerente)
-- ---------------------------------------------------------------------
create table public.consumiveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  categoria text,
  unidade text not null default 'un' check (length(trim(unidade)) > 0),
  stock_minimo numeric(12, 3) not null default 0 check (stock_minimo >= 0),
  ativo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.consumiveis is 'Artigos de consumo (adubos, fio, sacos, combustível…) com stock mínimo para alertas.';

create unique index consumiveis_nome_unico on public.consumiveis (lower(trim(nome)));

create trigger consumiveis_updated_at before update on public.consumiveis
  for each row execute function app.definir_updated_at();

-- O preço fica numa tabela à parte para que só o gerente o possa ler
-- (a RLS trabalha por linha, não por coluna).
create table public.consumiveis_precos (
  consumivel_id uuid primary key references public.consumiveis (id) on delete cascade,
  preco_unitario numeric(12, 2) not null default 0 check (preco_unitario >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.consumiveis_precos is 'Preço de compra (por unidade) de cada consumível. Só o gerente tem acesso.';

create trigger consumiveis_precos_updated_at before update on public.consumiveis_precos
  for each row execute function app.definir_updated_at();

-- ---------------------------------------------------------------------
-- Movimentos de stock (só o gerente vê: as entradas têm preço)
-- quantidade com sinal: entradas > 0, saídas < 0, acertos qualquer sinal.
-- O stock de um consumível é a soma das quantidades.
-- ---------------------------------------------------------------------
create table public.movimentos_stock (
  id uuid primary key default gen_random_uuid(),
  consumivel_id uuid not null references public.consumiveis (id) on delete restrict,
  tipo public.tipo_movimento_stock not null,
  quantidade numeric(12, 3) not null check (quantidade <> 0),
  data date not null default app.hoje(),
  trabalho_id uuid references public.trabalhos (id) on delete set null,
  -- Saída criada a partir de um material gasto num trabalho (mantida pela BD).
  registo_material_id uuid unique,
  preco_unitario numeric(12, 2) check (preco_unitario >= 0),
  notas text,
  colaborador_id uuid default app.colaborador_atual() references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movimentos_sinal check (
    (tipo = 'entrada' and quantidade > 0) or (tipo = 'saida' and quantidade < 0) or tipo = 'ajuste'
  )
);

comment on table public.movimentos_stock is 'Entradas, saídas e acertos de stock. As saídas dos trabalhos vêm dos materiais registados.';

create index movimentos_stock_consumivel_idx on public.movimentos_stock (consumivel_id, data desc);
create index movimentos_stock_trabalho_id_idx on public.movimentos_stock (trabalho_id) where trabalho_id is not null;
create index movimentos_stock_colaborador_id_idx on public.movimentos_stock (colaborador_id);

create trigger movimentos_stock_updated_at before update on public.movimentos_stock
  for each row execute function app.definir_updated_at();

-- Com movimentos, a unidade do consumível já não muda (o stock é a soma
-- das quantidades, todas nessa unidade).
create or replace function app.unidade_consumivel_fixa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unidade is distinct from old.unidade
     and exists (select 1 from public.movimentos_stock where consumivel_id = old.id) then
    raise exception 'Já há movimentos de stock nesta unidade, por isso não a pode mudar.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger consumiveis_unidade_fixa
  before update of unidade on public.consumiveis
  for each row execute function app.unidade_consumivel_fixa();

-- Stock atual de cada consumível (gerente e chefes; o colaborador não vê).
create or replace function public.stock_consumiveis()
returns table (consumivel_id uuid, stock numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, coalesce(sum(m.quantidade), 0)
  from public.consumiveis c
  left join public.movimentos_stock m on m.consumivel_id = c.id
  where app.e_gerente_ou_chefe()
  group by c.id;
$$;

-- ---------------------------------------------------------------------
-- Materiais gastos nos trabalhos ligados aos consumíveis
-- ---------------------------------------------------------------------
alter table public.registo_materiais
  add column consumivel_id uuid references public.consumiveis (id) on delete set null;

comment on column public.registo_materiais.consumivel_id is 'Consumível do catálogo (opcional): gera a saída de stock.';

create index registo_materiais_consumivel_id_idx on public.registo_materiais (consumivel_id) where consumivel_id is not null;

alter table public.movimentos_stock
  add constraint movimentos_stock_registo_material_fkey
  foreign key (registo_material_id) references public.registo_materiais (id) on delete cascade;

-- Antes de gravar: com consumível, a unidade é a dele e tem de estar ativo.
create or replace function app.preparar_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consumivel public.consumiveis;
begin
  if new.consumivel_id is not null then
    select * into v_consumivel from public.consumiveis where id = new.consumivel_id;
    if v_consumivel.id is null then
      raise exception 'O consumível não existe.' using errcode = 'foreign_key_violation';
    end if;
    if not v_consumivel.ativo
       and (tg_op = 'INSERT' or new.consumivel_id is distinct from old.consumivel_id) then
      raise exception 'Este consumível está desativado. Escolha outro.' using errcode = 'check_violation';
    end if;
    new.unidade := v_consumivel.unidade;
  end if;
  return new;
end;
$$;

create trigger registo_materiais_preparar
  before insert or update on public.registo_materiais
  for each row execute function app.preparar_material();

-- Depois de gravar: a saída de stock acompanha o material (criada,
-- atualizada ou apagada); o dia é o do trabalho.
create or replace function app.sincronizar_saida_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trabalho public.trabalhos;
begin
  if new.consumivel_id is null then
    delete from public.movimentos_stock where registo_material_id = new.id;
    return null;
  end if;

  select t.* into v_trabalho
  from public.registos_trabalho r join public.trabalhos t on t.id = r.trabalho_id
  where r.id = new.registo_id;

  insert into public.movimentos_stock (consumivel_id, tipo, quantidade, data, trabalho_id, registo_material_id, colaborador_id)
  values (new.consumivel_id, 'saida', -new.quantidade, coalesce(v_trabalho.data, app.hoje()), v_trabalho.id, new.id,
          app.colaborador_atual())
  on conflict (registo_material_id) do update
    set consumivel_id = excluded.consumivel_id,
        quantidade = excluded.quantidade,
        data = excluded.data,
        trabalho_id = excluded.trabalho_id;
  return null;
end;
$$;

create trigger registo_materiais_saida_stock
  after insert or update on public.registo_materiais
  for each row execute function app.sincronizar_saida_material();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.equipamentos enable row level security;
alter table public.manutencoes_equipamento enable row level security;
alter table public.consumiveis enable row level security;
alter table public.consumiveis_precos enable row level security;
alter table public.movimentos_stock enable row level security;

-- Equipamentos: gerente tudo; chefes veem todos e mudam o estado/notas dos
-- da sua equipa ou sem equipa (trigger acima); o colaborador não vê.
create policy "equipamentos: ver" on public.equipamentos
  for select to authenticated using ((select app.e_gerente_ou_chefe()));
create policy "equipamentos: criar (gerente)" on public.equipamentos
  for insert to authenticated with check ((select app.e_gerente()));
create policy "equipamentos: alterar" on public.equipamentos
  for update to authenticated
  using (
    (select app.e_gerente())
    or (
      (select app.perfil_atual()) = 'chefe_equipa'
      and (equipa_id is null or equipa_id in (select app.equipas_chefiadas()))
    )
  )
  with check (
    (select app.e_gerente())
    or (
      (select app.perfil_atual()) = 'chefe_equipa'
      and (equipa_id is null or equipa_id in (select app.equipas_chefiadas()))
    )
  );
create policy "equipamentos: apagar (gerente)" on public.equipamentos
  for delete to authenticated using ((select app.e_gerente()));

create policy "manutencoes: tudo (gerente)" on public.manutencoes_equipamento
  for all to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));

-- Consumíveis: todos com acesso veem o catálogo (o colaborador só os ativos,
-- para escolher os materiais); só o gerente os cria e altera.
create policy "consumiveis: ver" on public.consumiveis
  for select to authenticated using (
    (select app.e_gerente_ou_chefe())
    or ((select app.tem_acesso()) and ativo)
  );
create policy "consumiveis: criar (gerente)" on public.consumiveis
  for insert to authenticated with check ((select app.e_gerente()));
create policy "consumiveis: alterar (gerente)" on public.consumiveis
  for update to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));
create policy "consumiveis: apagar (gerente)" on public.consumiveis
  for delete to authenticated using ((select app.e_gerente()));

create policy "precos: tudo (gerente)" on public.consumiveis_precos
  for all to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));

-- Movimentos: só o gerente. As saídas dos materiais dos trabalhos são da BD
-- (acompanham o material): não se alteram nem apagam à mão.
create policy "movimentos: ver (gerente)" on public.movimentos_stock
  for select to authenticated using ((select app.e_gerente()));
create policy "movimentos: criar (gerente)" on public.movimentos_stock
  for insert to authenticated with check ((select app.e_gerente()) and registo_material_id is null);
create policy "movimentos: alterar (gerente)" on public.movimentos_stock
  for update to authenticated
  using ((select app.e_gerente()) and registo_material_id is null)
  with check ((select app.e_gerente()) and registo_material_id is null);
create policy "movimentos: apagar (gerente)" on public.movimentos_stock
  for delete to authenticated using ((select app.e_gerente()) and registo_material_id is null);

-- ---------------------------------------------------------------------
-- Grants para a Data API (o acesso real é decidido pela RLS)
-- ---------------------------------------------------------------------
revoke all on public.equipamentos, public.manutencoes_equipamento, public.consumiveis,
  public.consumiveis_precos, public.movimentos_stock from anon, authenticated;
grant select, insert, update, delete on public.equipamentos, public.manutencoes_equipamento,
  public.consumiveis, public.consumiveis_precos to authenticated;
-- A ligação de uma saída ao material é só da BD.
grant select, delete on public.movimentos_stock to authenticated;
grant insert (consumivel_id, tipo, quantidade, data, trabalho_id, preco_unitario, notas)
  on public.movimentos_stock to authenticated;
grant update (consumivel_id, tipo, quantidade, data, trabalho_id, preco_unitario, notas)
  on public.movimentos_stock to authenticated;
grant all on public.equipamentos, public.manutencoes_equipamento, public.consumiveis,
  public.consumiveis_precos, public.movimentos_stock to service_role;

revoke all on function public.stock_consumiveis() from public, anon;
grant execute on function public.stock_consumiveis() to authenticated, service_role;

revoke all on function app.restringir_alteracoes_equipamento() from public;
revoke all on function app.preparar_material() from public;
revoke all on function app.sincronizar_saida_material() from public;
revoke all on function app.unidade_consumivel_fixa() from public;
grant execute on function app.restringir_alteracoes_equipamento(), app.preparar_material(),
  app.sincronizar_saida_material(), app.unidade_consumivel_fixa() to authenticated, service_role;
