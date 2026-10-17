-- =====================================================================
-- Fatijardins — Fase 5: Dinheiro
-- Contratos de manutenção (avença por cliente/local, frequência das
-- visitas, serviços incluídos) com geração automática das visitas na
-- agenda e da cobrança mensal; cobranças (valores a receber, com a
-- referência da fatura emitida noutro programa) e pagamentos recebidos;
-- dívidas por cliente e atrasos. Tudo isto só o gerente vê.
-- A app não emite faturas (têm de sair de software certificado pela AT).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.frequencia_contrato as enum ('semanal', 'quinzenal', 'mensal');
create type public.estado_contrato as enum ('ativo', 'suspenso', 'terminado');
create type public.origem_cobranca as enum ('contrato', 'orcamento', 'avulsa');
create type public.estado_cobranca as enum ('por_pagar', 'parcial', 'paga', 'atrasada');
create type public.metodo_pagamento as enum ('transferencia', 'mbway', 'multibanco', 'numerario', 'cheque', 'outro');

-- ---------------------------------------------------------------------
-- Contratos de manutenção recorrente
-- ---------------------------------------------------------------------
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  -- O cliente vem do local (trigger).
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  local_id uuid not null references public.locais (id) on delete restrict,
  titulo text not null check (length(trim(titulo)) > 0),
  -- Serviços incluídos (um por linha); vão para a descrição de cada visita.
  servicos text,
  frequencia public.frequencia_contrato not null default 'semanal',
  equipa_id uuid references public.equipas (id) on delete set null,
  hora_inicio time,
  duracao_prevista_min integer check (duracao_prevista_min between 1 and 1440),
  -- Primeira visita; as seguintes repetem-se a partir dela (mensal: o mesmo
  -- dia do mês, ou o último dia nos meses mais curtos).
  data_inicio date not null,
  data_fim date,
  -- Avença mensal sem IVA.
  valor_mensal numeric(10, 2) not null check (valor_mensal >= 0),
  taxa_iva numeric(4, 1) not null default 23 check (taxa_iva in (23, 13, 6, 0)),
  -- Dia do mês em que a cobrança mensal vence.
  dia_cobranca smallint not null default 8 check (dia_cobranca between 1 and 28),
  estado public.estado_contrato not null default 'ativo',
  notas text,
  -- Mantidos pela BD: até que dia já há visitas na agenda e último mês cobrado.
  agendado_ate date,
  cobrado_ate date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contratos_datas check (data_fim is null or data_fim >= data_inicio)
);

comment on table public.contratos is 'Avenças de manutenção: geram as visitas na agenda e a cobrança mensal. Só o gerente tem acesso.';
comment on column public.contratos.agendado_ate is 'Até este dia as visitas já foram criadas (mantido pela BD).';
comment on column public.contratos.cobrado_ate is 'Último mês (1.º dia) com cobrança criada (mantido pela BD).';

create index contratos_cliente_id_idx on public.contratos (cliente_id);
create index contratos_local_id_idx on public.contratos (local_id);
create index contratos_equipa_id_idx on public.contratos (equipa_id);

create trigger contratos_updated_at before update on public.contratos
  for each row execute function app.definir_updated_at();

create trigger contratos_cliente_do_local
  before insert or update of local_id, cliente_id on public.contratos
  for each row execute function app.trabalho_cliente_do_local();

-- Visitas criadas por um contrato.
alter table public.trabalhos
  add column contrato_id uuid references public.contratos (id) on delete restrict;

create index trabalhos_contrato_id_idx on public.trabalhos (contrato_id, data) where contrato_id is not null;

-- Só a BD liga um trabalho a um contrato (ao gerar as visitas).
create or replace function app.proteger_contrato_do_trabalho()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.contrato_id := case when tg_op = 'INSERT' then null else old.contrato_id end;
  end if;
  return new;
end;
$$;

create trigger trabalhos_proteger_contrato
  before insert or update on public.trabalhos
  for each row execute function app.proteger_contrato_do_trabalho();

-- ---------------------------------------------------------------------
-- Cobranças (valores a receber) e pagamentos
-- ---------------------------------------------------------------------
create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  local_id uuid references public.locais (id) on delete set null,
  origem public.origem_cobranca not null default 'avulsa',
  contrato_id uuid references public.contratos (id) on delete restrict,
  orcamento_id uuid references public.orcamentos (id) on delete restrict,
  descricao text not null check (length(trim(descricao)) > 0),
  -- Mês da avença (1.º dia), só nas cobranças dos contratos.
  periodo date,
  data_emissao date not null default app.hoje(),
  data_vencimento date not null default app.hoje(),
  -- Total a receber (com IVA).
  valor numeric(12, 2) not null check (valor > 0),
  -- Fatura emitida no programa de faturação certificado (a app não emite faturas).
  fatura_referencia text,
  fatura_data date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cobrancas_vencimento check (data_vencimento >= data_emissao),
  constraint cobrancas_origem_contrato check ((origem = 'contrato') = (contrato_id is not null)),
  constraint cobrancas_origem_orcamento check ((origem = 'orcamento') = (orcamento_id is not null)),
  constraint cobrancas_periodo check ((periodo is not null) = (contrato_id is not null)),
  constraint cobrancas_contrato_periodo unique (contrato_id, periodo)
);

comment on table public.cobrancas is 'Valores a receber dos clientes (avenças, orçamentos, avulsos), com a referência da fatura. Só o gerente tem acesso.';
comment on column public.cobrancas.fatura_referencia is 'N.º da fatura emitida noutro programa (ex.: FT 2026/123). Preparado para uma futura integração.';

create index cobrancas_cliente_id_idx on public.cobrancas (cliente_id, data_vencimento);
create index cobrancas_local_id_idx on public.cobrancas (local_id);
create index cobrancas_orcamento_id_idx on public.cobrancas (orcamento_id) where orcamento_id is not null;

create trigger cobrancas_updated_at before update on public.cobrancas
  for each row execute function app.definir_updated_at();

-- O cliente (e o local) vêm do orçamento ou do local escolhido.
create or replace function app.preparar_cobranca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.orcamento_id is not null then
    select o.cliente_id, o.local_id into new.cliente_id, new.local_id
    from public.orcamentos o where o.id = new.orcamento_id;
  elsif new.local_id is not null then
    select l.cliente_id into new.cliente_id from public.locais l where l.id = new.local_id;
  end if;
  return new;
end;
$$;

create trigger cobrancas_preparar
  before insert on public.cobrancas
  for each row execute function app.preparar_cobranca();

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas (id) on delete restrict,
  data date not null default app.hoje(),
  valor numeric(12, 2) not null check (valor > 0),
  metodo public.metodo_pagamento not null default 'transferencia',
  -- Referência do pagamento (ex.: n.º da transferência, recibo).
  referencia text,
  notas text,
  colaborador_id uuid default app.colaborador_atual() references public.colaboradores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pagamentos is 'Pagamentos recebidos, cada um de uma cobrança. Só o gerente tem acesso.';

create index pagamentos_cobranca_id_idx on public.pagamentos (cobranca_id);
create index pagamentos_data_idx on public.pagamentos (data desc);
create index pagamentos_colaborador_id_idx on public.pagamentos (colaborador_id);

create trigger pagamentos_updated_at before update on public.pagamentos
  for each row execute function app.definir_updated_at();

-- Os pagamentos de uma cobrança não passam do seu valor (e o valor da
-- cobrança não desce abaixo do que já foi pago).
-- Corre com as permissões de quem grava (security invoker): quem não pode ler
-- a cobrança não fica a saber o valor em dívida pela mensagem de erro.
create or replace function app.limitar_pagamentos()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_valor numeric;
  v_pago numeric;
begin
  if tg_table_name = 'pagamentos' then
    select c.valor into v_valor from public.cobrancas c where c.id = new.cobranca_id for update;
    select coalesce(sum(p.valor), 0) into v_pago
    from public.pagamentos p where p.cobranca_id = new.cobranca_id and p.id <> new.id;
    if v_pago + new.valor > v_valor then
      raise exception 'O pagamento passa o valor em dívida desta cobrança (faltam % €).',
        replace(to_char(v_valor - v_pago, 'FM999999990.00'), '.', ',')
        using errcode = 'check_violation';
    end if;
  else
    select coalesce(sum(p.valor), 0) into v_pago from public.pagamentos p where p.cobranca_id = new.id;
    if new.valor < v_pago then
      raise exception 'O valor não pode ficar abaixo do que já foi pago.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger pagamentos_limitar
  before insert or update of valor, cobranca_id on public.pagamentos
  for each row execute function app.limitar_pagamentos();

create trigger cobrancas_limitar
  before update of valor on public.cobrancas
  for each row execute function app.limitar_pagamentos();

-- Saldo e estado de cada cobrança (a RLS das tabelas aplica-se: só o gerente).
create view public.cobrancas_com_saldo with (security_invoker = true) as
select
  c.*,
  coalesce(sum(p.valor), 0)::numeric(12, 2) as pago,
  (c.valor - coalesce(sum(p.valor), 0))::numeric(12, 2) as em_divida,
  (case
    when c.valor - coalesce(sum(p.valor), 0) <= 0 then 'paga'
    when c.data_vencimento < app.hoje() then 'atrasada'
    when coalesce(sum(p.valor), 0) > 0 then 'parcial'
    else 'por_pagar'
  end)::public.estado_cobranca as estado,
  (case
    when c.valor - coalesce(sum(p.valor), 0) > 0 and c.data_vencimento < app.hoje()
      then app.hoje() - c.data_vencimento
    else 0
  end) as dias_atraso
from public.cobrancas c
left join public.pagamentos p on p.cobranca_id = c.id
group by c.id;

-- Dívida de cada cliente (só os que devem alguma coisa).
create view public.dividas_clientes with (security_invoker = true) as
select
  s.cliente_id,
  cl.nome,
  sum(s.em_divida)::numeric(12, 2) as em_divida,
  coalesce(sum(s.em_divida) filter (where s.estado = 'atrasada'), 0)::numeric(12, 2) as em_atraso,
  count(*)::integer as cobrancas_abertas,
  count(*) filter (where s.estado = 'atrasada')::integer as cobrancas_atrasadas,
  min(s.data_vencimento) filter (where s.estado = 'atrasada') as vencida_desde
from public.cobrancas_com_saldo s
join public.clientes cl on cl.id = s.cliente_id
where s.em_divida > 0
group by s.cliente_id, cl.nome;

-- ---------------------------------------------------------------------
-- Geração automática: visitas na agenda (próximas 8 semanas) e cobrança
-- mensal (no início de cada mês). Corre ao criar/alterar um contrato,
-- todos os dias às 05:15 UTC (pg_cron) e quando o gerente pede.
-- ---------------------------------------------------------------------
create or replace function app.gerar_contrato(p_contrato_id uuid, out trabalhos integer, out cobrancas integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contratos;
  v_hoje date := app.hoje();
  v_ate date;
  v_desde date;
  v_data date;
  v_n integer := 0;
  v_ordem integer;
  v_mes date;
  v_ultimo_mes date;
  v_criado date;
  v_inseridas integer;
  v_meses constant text[] := array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
begin
  trabalhos := 0;
  cobrancas := 0;
  select * into c from public.contratos where id = p_contrato_id for update;
  if c.id is null or c.estado <> 'ativo' then
    return;
  end if;
  v_criado := (c.created_at at time zone 'Europe/Lisbon')::date;

  -- Visitas: as datas da série entre o dia seguinte ao último já agendado
  -- (ou hoje) e daqui a 8 semanas (ou o fim do contrato).
  v_ate := least(v_hoje + 56, coalesce(c.data_fim, v_hoje + 56));
  v_desde := greatest(v_hoje, coalesce(c.agendado_ate + 1, v_hoje));
  if v_ate >= v_desde then
    loop
      v_data := case c.frequencia
        when 'mensal' then (c.data_inicio + make_interval(months => v_n))::date
        when 'quinzenal' then c.data_inicio + 14 * v_n
        else c.data_inicio + 7 * v_n
      end;
      exit when v_data > v_ate;
      -- Um dia que já tem uma visita deste contrato (mesmo cancelada ou já
      -- começada) não recebe outra.
      if v_data >= v_desde and not exists
         (select 1 from public.trabalhos t where t.contrato_id = c.id and t.data = v_data) then
        -- Lugar na ordem do dia como na app (lugarNaOrdem): antes do primeiro
        -- trabalho com hora posterior; senão logo a seguir ao último com hora
        -- (os seguintes descem um lugar); sem hora, no fim.
        v_ordem := null;
        if c.hora_inicio is not null then
          select min(t.ordem) into v_ordem from public.trabalhos t
          where t.data = v_data and t.equipa_id is not distinct from c.equipa_id
            and t.hora_inicio > c.hora_inicio;
          if v_ordem is null then
            select max(t.ordem) + 1 into v_ordem from public.trabalhos t
            where t.data = v_data and t.equipa_id is not distinct from c.equipa_id
              and t.hora_inicio is not null;
          end if;
        end if;
        if v_ordem is null then
          select coalesce(max(t.ordem), 0) + 1 into v_ordem from public.trabalhos t
          where t.data = v_data and t.equipa_id is not distinct from c.equipa_id;
        else
          update public.trabalhos t set ordem = t.ordem + 1
          where t.data = v_data and t.equipa_id is not distinct from c.equipa_id and t.ordem >= v_ordem;
        end if;
        insert into public.trabalhos (local_id, cliente_id, titulo, descricao, tipo, origem, contrato_id, data,
          hora_inicio, duracao_prevista_min, equipa_id, ordem)
        values (c.local_id, c.cliente_id, c.titulo, c.servicos, 'manutencao', 'contrato', c.id, v_data,
          c.hora_inicio, c.duracao_prevista_min, c.equipa_id, v_ordem);
        trabalhos := trabalhos + 1;
      end if;
      v_n := v_n + 1;
    end loop;
    update public.contratos set agendado_ate = v_ate where id = c.id;
  end if;

  -- Cobranças: uma por mês, desde o mês de início (mas não antes do mês em
  -- que o contrato foi registado) até ao mês atual (ou ao do fim). Os meses
  -- sem valor também contam como tratados (não se cobram mais tarde).
  begin
    v_mes := greatest(
      date_trunc('month', c.data_inicio)::date,
      date_trunc('month', v_criado)::date,
      coalesce((c.cobrado_ate + interval '1 month')::date, date '-infinity')
    );
    v_ultimo_mes := date_trunc('month', least(v_hoje, coalesce(c.data_fim, v_hoje)))::date;
    while v_mes <= v_ultimo_mes loop
      if c.valor_mensal > 0 then
        insert into public.cobrancas (cliente_id, local_id, origem, contrato_id, descricao, periodo, data_emissao,
          data_vencimento, valor)
        values (c.cliente_id, c.local_id, 'contrato', c.id,
          'Avença de ' || v_meses[extract(month from v_mes)::integer] || ' de ' || extract(year from v_mes)::integer
            || ' — ' || c.titulo,
          v_mes, v_mes,
          greatest(make_date(extract(year from v_mes)::integer, extract(month from v_mes)::integer, c.dia_cobranca), v_criado),
          round(c.valor_mensal * (1 + c.taxa_iva / 100), 2))
        on conflict (contrato_id, periodo) do nothing;
        get diagnostics v_inseridas = row_count;
        cobrancas := cobrancas + v_inseridas;
      end if;
      update public.contratos set cobrado_ate = v_mes where id = c.id;
      v_mes := (v_mes + interval '1 month')::date;
    end loop;
  end;
end;
$$;

-- Todos os contratos ativos (pg_cron e botão "Gerar agora").
create or replace function app.gerar_contratos(out trabalhos integer, out cobrancas integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_t integer;
  v_c integer;
begin
  trabalhos := 0;
  cobrancas := 0;
  for v_id in select id from public.contratos where estado = 'ativo' order by created_at loop
    select g.trabalhos, g.cobrancas into v_t, v_c from app.gerar_contrato(v_id) g;
    trabalhos := trabalhos + v_t;
    cobrancas := cobrancas + v_c;
  end loop;
end;
$$;

create or replace function public.gerar_contratos(out trabalhos integer, out cobrancas integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.e_gerente() then
    raise exception 'Só o gerente pode gerar as visitas e as cobranças dos contratos.'
      using errcode = 'insufficient_privilege';
  end if;
  select g.trabalhos, g.cobrancas into trabalhos, cobrancas from app.gerar_contratos() g;
end;
$$;

-- Contrato novo: gera logo as visitas e a cobrança do mês.
create or replace function app.contrato_criado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.gerar_contrato(new.id);
  return null;
end;
$$;

create trigger contratos_gerar
  after insert on public.contratos
  for each row execute function app.contrato_criado();

-- Contrato alterado (visitas, estado, datas): as visitas futuras ainda por
-- começar são refeitas com os dados novos; suspenso ou terminado deixa de
-- ter visitas futuras. Ao reativar, os meses de suspensão não são cobrados.
create or replace function app.contrato_alterado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := app.hoje();
begin
  -- Só o título, os serviços ou a duração: atualizam-se as visitas futuras
  -- agendadas (sem refazer a série, que perderia mudanças feitas na agenda).
  if (new.estado, new.frequencia, new.data_inicio, new.data_fim, new.equipa_id, new.hora_inicio, new.local_id)
     is not distinct from
     (old.estado, old.frequencia, old.data_inicio, old.data_fim, old.equipa_id, old.hora_inicio, old.local_id) then
    update public.trabalhos t
    set titulo = new.titulo, descricao = new.servicos, duracao_prevista_min = new.duracao_prevista_min
    where t.contrato_id = new.id and t.data > v_hoje and t.estado = 'agendado';
    return null;
  end if;

  delete from public.trabalhos t
  where t.contrato_id = new.id
    and t.data > v_hoje
    and t.estado = 'agendado'
    and not exists (select 1 from public.registos_trabalho r where r.trabalho_id = t.id)
    and not exists (select 1 from public.registos_horas h where h.trabalho_id = t.id)
    and not exists (select 1 from public.fotos f where f.trabalho_id = t.id);

  update public.contratos
  set agendado_ate = v_hoje,
      -- Reativar (ou prolongar um contrato que já tinha acabado): os meses
      -- parados não são cobrados.
      cobrado_ate = case
        when (old.estado <> 'ativo' and new.estado = 'ativo')
          or (old.data_fim < date_trunc('month', v_hoje) and new.data_fim is distinct from old.data_fim)
          then greatest(cobrado_ate, (date_trunc('month', v_hoje) - interval '1 month')::date)
        else cobrado_ate
      end
  where id = new.id;

  if new.estado = 'ativo' then
    perform app.gerar_contrato(new.id);
  end if;
  return null;
end;
$$;

create trigger contratos_alterado
  after update of estado, frequencia, data_inicio, data_fim, equipa_id, hora_inicio, duracao_prevista_min,
    titulo, servicos, local_id on public.contratos
  for each row execute function app.contrato_alterado();

-- Apaga um contrato criado por engano (só o gerente), tudo ou nada: as
-- visitas de hoje em diante ainda agendadas e sem registos/horas/fotos, as
-- cobranças sem pagamentos nem fatura e o contrato. Se houver mais alguma
-- coisa (visitas feitas, cobranças pagas ou faturadas), não apaga nada.
create or replace function public.apagar_contrato(p_contrato_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := app.hoje();
begin
  if not app.e_gerente() then
    raise exception 'Só o gerente pode apagar contratos.' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from public.contratos where id = p_contrato_id for update;
  if not found then
    return false;
  end if;
  if exists (
    select 1 from public.trabalhos t
    where t.contrato_id = p_contrato_id
      and (t.estado in ('em_curso', 'concluido') or (t.data < v_hoje and t.estado <> 'cancelado')
        or exists (select 1 from public.registos_trabalho r where r.trabalho_id = t.id)
        or exists (select 1 from public.registos_horas h where h.trabalho_id = t.id)
        or exists (select 1 from public.fotos f where f.trabalho_id = t.id))
  ) or exists (
    select 1 from public.cobrancas c
    where c.contrato_id = p_contrato_id
      and (c.fatura_referencia is not null or exists (select 1 from public.pagamentos p where p.cobranca_id = c.id))
  ) then
    raise exception 'Este contrato já tem cobranças ou visitas feitas: termine-o em vez de o apagar.'
      using errcode = 'check_violation';
  end if;
  delete from public.trabalhos where contrato_id = p_contrato_id;
  delete from public.cobrancas where contrato_id = p_contrato_id;
  delete from public.contratos where id = p_contrato_id;
  return true;
end;
$$;

-- Todos os dias de manhã (pg_cron). Se a extensão não estiver disponível,
-- a geração continua a correr ao gravar contratos e com "Gerar agora".
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('fatijardins-contratos', '15 5 * * *', 'select app.gerar_contratos()');
exception when others then
  raise notice 'pg_cron indisponível (%): a geração diária automática não ficou agendada.', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security: só o gerente
-- ---------------------------------------------------------------------
alter table public.contratos enable row level security;
alter table public.cobrancas enable row level security;
alter table public.pagamentos enable row level security;

create policy "contratos: tudo (gerente)" on public.contratos
  for all to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));
create policy "cobrancas: tudo (gerente)" on public.cobrancas
  for all to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));
create policy "pagamentos: tudo (gerente)" on public.pagamentos
  for all to authenticated using ((select app.e_gerente())) with check ((select app.e_gerente()));

-- ---------------------------------------------------------------------
-- Grants para a Data API (o acesso real é decidido pela RLS)
-- ---------------------------------------------------------------------
revoke all on public.contratos, public.cobrancas, public.pagamentos, public.cobrancas_com_saldo,
  public.dividas_clientes from anon, authenticated;

grant select, delete on public.contratos to authenticated;
grant insert (local_id, titulo, servicos, frequencia, equipa_id, hora_inicio, duracao_prevista_min, data_inicio,
  data_fim, valor_mensal, taxa_iva, dia_cobranca, estado, notas) on public.contratos to authenticated;
grant update (local_id, titulo, servicos, frequencia, equipa_id, hora_inicio, duracao_prevista_min, data_inicio,
  data_fim, valor_mensal, taxa_iva, dia_cobranca, estado, notas) on public.contratos to authenticated;

grant select, delete on public.cobrancas to authenticated;
grant insert (cliente_id, local_id, orcamento_id, origem, descricao, data_emissao, data_vencimento, valor,
  fatura_referencia, fatura_data, notas) on public.cobrancas to authenticated;
grant update (descricao, data_emissao, data_vencimento, valor, fatura_referencia, fatura_data, notas)
  on public.cobrancas to authenticated;

grant select, delete on public.pagamentos to authenticated;
grant insert (cobranca_id, data, valor, metodo, referencia, notas) on public.pagamentos to authenticated;
grant update (data, valor, metodo, referencia, notas) on public.pagamentos to authenticated;

grant select on public.cobrancas_com_saldo, public.dividas_clientes to authenticated;

grant all on public.contratos, public.cobrancas, public.pagamentos to service_role;
grant select on public.cobrancas_com_saldo, public.dividas_clientes to service_role;

revoke all on function public.gerar_contratos(), public.apagar_contrato(uuid) from public, anon;
grant execute on function public.gerar_contratos(), public.apagar_contrato(uuid) to authenticated, service_role;

revoke all on function app.gerar_contrato(uuid), app.gerar_contratos() from public, authenticated;
revoke all on function app.proteger_contrato_do_trabalho(), app.preparar_cobranca(), app.limitar_pagamentos(),
  app.contrato_criado(), app.contrato_alterado() from public;
grant execute on function app.proteger_contrato_do_trabalho(), app.preparar_cobranca(), app.limitar_pagamentos(),
  app.contrato_criado(), app.contrato_alterado() to authenticated, service_role;
