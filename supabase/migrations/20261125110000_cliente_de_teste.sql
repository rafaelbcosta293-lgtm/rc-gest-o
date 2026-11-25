-- Cliente de teste: uma ficha fictícia, fixa, para a equipa ver a app do
-- cliente "do lado de lá" e testar (marcar aulas, ver aulas virtuais,
-- treinos...) sem criar e apagar clientes a sério.
--
-- * clientes.teste marca-o. Fica na base de dados e aparece nas listas
--   do dia a dia (agenda, ficha, aulas), mas NUNCA entra em estatísticas,
--   contagens, alertas, SMS automáticos nem mudanças automáticas de
--   estado (ver os filtros .eq('teste', false) no código).
-- * Não precisa de pagamentos (que contariam na faturação): para as
--   regras da app, as mensalidades dele estão sempre em dia.

alter table public.clientes add column teste boolean not null default false;
create index clientes_teste_idx on public.clientes (teste) where teste;

-- Mensalidade sempre em dia para o cliente de teste (reservas pela app).
create or replace function public.mensalidade_em_dia(p_cliente uuid, p_servico smallint, p_dia date)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.clientes c where c.id = p_cliente and c.teste)
      or exists (
    select 1 from public.pagamentos p
     where p.cliente_id = p_cliente and p.anulado_em is null and p.mensalidade
       and p.servico_id = p_servico and p.valido_ate >= p_dia
  );
$function$;

-- Contagens e listas de gestão: o cliente de teste fica de fora.
create or replace function public.contar_pagamentos_em_atraso(p_estudio smallint)
 returns integer
 language sql
 stable
 set search_path to 'public'
as $function$
  select count(*)::integer
  from public.clientes c
  where c.estudio_id = p_estudio
    and c.cliente_pt
    and not c.teste
    and c.estado <> 'Inativo'::public.estado_cliente
    and not exists (
      select 1 from public.pagamentos p
      where p.cliente_id = c.id and p.anulado_em is null and p.mensalidade and p.servico_id = 1 and p.valido_ate >= current_date
    );
$function$;

create or replace function public.aniversarios_do_mes(p_estudio smallint, p_mes integer)
 returns table(cliente_id uuid, nome text, dia integer, nascimento date, estado estado_cliente, telefone text, idade integer)
 language sql
 stable
 set search_path to 'public'
as $function$
  select c.id, c.nome, date_part('day', c.nascimento)::int, c.nascimento, c.estado, c.telefone,
         date_part('year', age(c.nascimento))::int
  from clientes c
  where c.estudio_id = p_estudio
    and not c.teste
    and c.nascimento is not null
    and date_part('month', c.nascimento) = p_mes
  order by date_part('day', c.nascimento);
$function$;

create or replace function public.atualizar_clientes_sem_agendamento()
 returns jsonb
 language plpgsql
as $function$
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
    and not c.teste
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
$function$;

create or replace view public.v_estado_pagamento with (security_invoker = true) as
 select c.id as cliente_id,
    c.estudio_id,
    c.nome,
    max(p.valido_ate) as valido_ate,
    coalesce((max(p.valido_ate) >= current_date), false) as em_dia
   from (clientes c
     left join pagamentos p on (((p.cliente_id = c.id) and (p.anulado_em is null) and p.mensalidade and (p.servico_id = 1))))
  where ((c.estado = 'Ativo'::estado_cliente) and c.cliente_pt and not c.teste and (( select e_admin() as e_admin) or (c.estudio_id = any (( select estudios_acessiveis() as estudios_acessiveis)::smallint[]))))
  group by c.id, c.estudio_id, c.nome;

create or replace view public.v_reavaliacoes_pendentes with (security_invoker = true) as
 select c.id as cliente_id,
    c.nome,
    c.estudio_id,
    c.pt_principal_id,
    a.data as ultima_avaliacao,
    a.proxima_reavaliacao,
    (a.proxima_reavaliacao - current_date) as dias_para_reavaliar,
    ((a.id is null) or (a.proxima_reavaliacao is null) or ((a.proxima_reavaliacao - current_date) <= 14)) as precisa_atencao
   from (clientes c
     left join lateral ( select avaliacoes.id,
            avaliacoes.data,
            avaliacoes.proxima_reavaliacao
           from avaliacoes
          where (avaliacoes.cliente_id = c.id)
          order by avaliacoes.data desc
         limit 1) a on (true))
  where ((c.estado = 'Ativo'::estado_cliente) and c.cliente_pt and not c.teste);

create or replace view public.v_clientes_sem_treino_recente with (security_invoker = true) as
 select c.id as cliente_id,
    c.estudio_id,
    c.nome,
    c.telefone,
    max(p.data) filter (where (p.estado = 'Presente'::estado_presenca)) as ultima_presenca,
    greatest(0, (current_date - coalesce(max(p.data) filter (where (p.estado = 'Presente'::estado_presenca)), c.inicio_contrato, (c.criado_em)::date))) as dias_sem_treino
   from (clientes c
     left join presencas p on ((p.cliente_id = c.id)))
  where ((c.estado = 'Ativo'::estado_cliente) and c.cliente_pt and not c.teste)
  group by c.id;

-- A ficha do cliente de teste (Fátima). Nº de cliente próprio ("TESTE"),
-- para não gastar um número da sequência dos clientes reais. Estado
-- fixo (estado_automatico = false) e todos os serviços ativos.
insert into public.clientes (estudio_id, nome, nome_preferido, numero_socio, estado, estado_automatico, cliente_pt, teste, inicio_contrato, frequencia_semanal, notas)
select e.id, 'Cliente Teste', 'Teste', 'TESTE', 'Ativo', false, true, true, current_date, 2,
       'Cliente fictício para testar a app do cliente. Não entra em nenhuma estatística. Não apagar.'
  from public.estudios e
 where e.slug = 'fatima'
   and not exists (select 1 from public.clientes where teste);

insert into public.clientes_servicos (cliente_id, servico_id, estado, estado_automatico, inicio)
select c.id, s.id, 'Ativo', false, current_date
  from public.clientes c cross join public.servicos s
 where c.teste and s.ativo and s.chave <> 'pt'  -- o PT é o cliente_pt da ficha
on conflict do nothing;
