-- Os agendamentos passaram a ser feitos na agenda da app (já não no
-- Google Calendar). "Clientes sem agendamento" (Coordenação →
-- Pendências, clientes inativos) passa a ser calculado a partir de
-- agenda_eventos, em vez da Edge Function sync-agendamentos, que lia
-- os Google Calendars dos estúdios.
--
-- Mesmas regras de antes: só clientes "Ativo"; conta como "com
-- agendamento" quem tem algum evento marcado (estado "Agendado") que
-- ainda não terminou e começa nos próximos 60 dias, em qualquer
-- estúdio. A tabela continua a ser uma cache, para a página de
-- Pendências não mudar.
create or replace function public.atualizar_clientes_sem_agendamento()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_agora timestamp := now() at time zone 'Europe/Lisbon';
  v_ids uuid[];
  v_removidos int;
begin
  select coalesce(array_agg(c.id), '{}')
  into v_ids
  from clientes c
  where c.estado = 'Ativo'
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

revoke all on function public.atualizar_clientes_sem_agendamento() from public, anon, authenticated;
grant execute on function public.atualizar_clientes_sem_agendamento() to service_role;

-- O job de hora a hora deixa de chamar a Edge Function sync-agendamentos
-- (Google Calendar) e passa a chamar esta função, aos 5 minutos de cada hora.
select cron.unschedule('sync-agendamentos')
where exists (select 1 from cron.job where jobname = 'sync-agendamentos');

select cron.schedule(
  'clientes-sem-agendamento',
  '5 * * * *',
  $cmd$ select public.atualizar_clientes_sem_agendamento(); $cmd$
);

-- Atualiza já a lista, sem esperar pela próxima hora.
select public.atualizar_clientes_sem_agendamento();
