-- Fase 2 dos serviços: estado de cada cliente em cada serviço.
--
-- * clientes.estado continua a ser o estado no Treino Personalizado (é o
--   que as listas e métricas de PT usam). clientes.cliente_pt diz se a
--   pessoa é cliente de PT — quem só faz aulas de grupo fica false e não
--   entra em nenhuma métrica de PT. Para esses, clientes.estado espelha o
--   melhor estado que têm nos outros serviços (para as listas gerais —
--   agenda, pesquisa, pagamentos — continuarem a funcionar).
-- * clientes_servicos: a inscrição em cada um dos outros serviços
--   (Treino Acompanhado, Pilates, Nutrição), com o estado próprio,
--   calculado pelos pagamentos desse serviço (mesmas regras do PT).

alter table public.clientes add column cliente_pt boolean not null default true;

create table public.clientes_servicos (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  servico_id smallint not null references public.servicos(id) check (servico_id <> 1),
  estado public.estado_cliente not null default 'Pendente',
  estado_automatico boolean not null default true,
  inicio date,
  saiu_em date,
  criado_em timestamptz not null default now(),
  primary key (cliente_id, servico_id)
);
create index clientes_servicos_servico_idx on public.clientes_servicos (servico_id, estado);

alter table public.clientes_servicos enable row level security;
create policy ver_clientes_servicos on public.clientes_servicos for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = cliente_id and public.tenho_estudio(c.estudio_id)));
create policy criar_clientes_servicos on public.clientes_servicos for insert to authenticated
  with check (exists (select 1 from public.clientes c where c.id = cliente_id and public.tenho_estudio(c.estudio_id)));
create policy editar_clientes_servicos on public.clientes_servicos for update to authenticated
  using (exists (select 1 from public.clientes c where c.id = cliente_id and public.tenho_estudio(c.estudio_id)))
  with check (exists (select 1 from public.clientes c where c.id = cliente_id and public.tenho_estudio(c.estudio_id)));
create policy apagar_clientes_servicos on public.clientes_servicos for delete to authenticated
  using (public.e_gestao() and exists (select 1 from public.clientes c where c.id = cliente_id and public.tenho_estudio(c.estudio_id)));

-- Validade de cada cliente em cada serviço (mensalidades não anuladas).
create view public.v_validade_por_servico with (security_invoker = true) as
select p.cliente_id, p.servico_id, max(p.valido_ate) as validade_maxima, min(p.data_pagamento) as primeiro_pagamento
from public.pagamentos p
where p.anulado_em is null and p.mensalidade
group by p.cliente_id, p.servico_id;
grant select on public.v_validade_por_servico to authenticated, service_role;

-- As vistas e funções de PT passam a olhar só para o PT.
create or replace view public.v_resumo_pagamentos_cliente with (security_invoker = true) as
 SELECT DISTINCT ON (p.cliente_id) p.cliente_id,
    c.estudio_id,
    p.data_pagamento AS ultimo_pagamento,
    p.valido_ate AS ultimo_valido_ate,
    p.valor AS ultimo_valor,
    max(p.valido_ate) OVER (PARTITION BY p.cliente_id) AS validade_maxima
   FROM (pagamentos p
     JOIN clientes c ON ((c.id = p.cliente_id)))
  WHERE ((p.anulado_em IS NULL) AND p.mensalidade AND p.servico_id = 1)
  ORDER BY p.cliente_id, p.data_pagamento DESC, p.criado_em DESC;

create or replace view public.v_estado_pagamento with (security_invoker = true) as
 SELECT c.id AS cliente_id,
    c.estudio_id,
    c.nome,
    max(p.valido_ate) AS valido_ate,
    COALESCE((max(p.valido_ate) >= CURRENT_DATE), false) AS em_dia
   FROM (clientes c
     LEFT JOIN pagamentos p ON (((p.cliente_id = c.id) AND (p.anulado_em IS NULL) AND p.mensalidade AND p.servico_id = 1)))
  WHERE ((c.estado = 'Ativo'::estado_cliente) AND c.cliente_pt AND (( SELECT e_admin() AS e_admin) OR (c.estudio_id = ANY (( SELECT estudios_acessiveis() AS estudios_acessiveis)::smallint[]))))
  GROUP BY c.id, c.estudio_id, c.nome;

create or replace view public.v_clientes_sem_treino_recente with (security_invoker = true) as
 SELECT c.id AS cliente_id,
    c.estudio_id,
    c.nome,
    c.telefone,
    max(p.data) FILTER (WHERE (p.estado = 'Presente'::estado_presenca)) AS ultima_presenca,
    GREATEST(0, (CURRENT_DATE - COALESCE(max(p.data) FILTER (WHERE (p.estado = 'Presente'::estado_presenca)), c.inicio_contrato, (c.criado_em)::date))) AS dias_sem_treino
   FROM (clientes c
     LEFT JOIN presencas p ON ((p.cliente_id = c.id)))
  WHERE (c.estado = 'Ativo'::estado_cliente) AND c.cliente_pt
  GROUP BY c.id;

create or replace view public.v_reavaliacoes_pendentes with (security_invoker = true) as
 SELECT c.id AS cliente_id,
    c.nome,
    c.estudio_id,
    c.pt_principal_id,
    a.data AS ultima_avaliacao,
    a.proxima_reavaliacao,
    (a.proxima_reavaliacao - CURRENT_DATE) AS dias_para_reavaliar,
    ((a.id IS NULL) OR (a.proxima_reavaliacao IS NULL) OR ((a.proxima_reavaliacao - CURRENT_DATE) <= 14)) AS precisa_atencao
   FROM (clientes c
     LEFT JOIN LATERAL ( SELECT avaliacoes.id, avaliacoes.data, avaliacoes.proxima_reavaliacao
           FROM avaliacoes
          WHERE (avaliacoes.cliente_id = c.id)
          ORDER BY avaliacoes.data DESC
         LIMIT 1) a ON (true))
  WHERE (c.estado = 'Ativo'::estado_cliente) AND c.cliente_pt;

create or replace function public.contar_pagamentos_em_atraso(p_estudio smallint)
returns integer language sql stable set search_path = public as $$
  select count(*)::integer
  from public.clientes c
  where c.estudio_id = p_estudio
    and c.cliente_pt
    and c.estado <> 'Inativo'::public.estado_cliente
    and not exists (
      select 1 from public.pagamentos p
      where p.cliente_id = c.id and p.anulado_em is null and p.mensalidade and p.servico_id = 1 and p.valido_ate >= current_date
    );
$$;

create or replace function public.resumo_presencas(p_ano integer, p_mes integer)
returns table(cliente_id uuid, nome text, estudio_id smallint, frequencia smallint, previstos integer, realizados bigint, faltas bigint, faltas_avisadas bigint, remarcados bigint)
language sql stable as $$
  select
    c.id, c.nome, c.estudio_id, c.frequencia_semanal,
    treinos_previstos(c.frequencia_semanal, p_ano, p_mes),
    count(*) filter (where p.estado = 'Presente'),
    count(*) filter (where p.estado = 'Faltou'),
    count(*) filter (where p.estado = 'Faltou (avisou)'),
    count(*) filter (where p.estado = 'Remarcado')
  from clientes c
  left join presencas p
    on p.cliente_id = c.id
   and date_part('year', p.data) = p_ano
   and date_part('month', p.data) = p_mes
  where c.estado = 'Ativo' and c.cliente_pt
  group by c.id, c.nome, c.estudio_id, c.frequencia_semanal;
$$;

create or replace function public.atualizar_clientes_sem_agendamento()
returns jsonb language plpgsql as $$
declare
  v_agora timestamp := now() at time zone 'Europe/Lisbon';
  v_ids uuid[];
  v_removidos int;
begin
  select coalesce(array_agg(c.id), '{}')
  into v_ids
  from clientes c
  where c.estado = 'Ativo'
    and c.cliente_pt
    and not exists (
      select 1
      from agenda_eventos e
      where e.cliente_id = c.id
        and e.estado = 'Agendado'
        and e.data + e.hora_inicio + make_interval(mins => e.duracao_min) > v_agora
        and e.data + e.hora_inicio < v_agora + interval '60 days'
    );

  delete from clientes_sem_agendamento
  where not (cliente_id = any (v_ids));
  get diagnostics v_removidos = row_count;

  insert into clientes_sem_agendamento (cliente_id, verificado_em)
  select unnest(v_ids), now()
  on conflict (cliente_id) do update set verificado_em = excluded.verificado_em;

  return jsonb_build_object('ok', true, 'sem_agendamento', cardinality(v_ids), 'removidos', v_removidos);
end;
$$;
