-- Presenças automáticas da agenda interna: a cada 15 minutos, só entre
-- as 07h e as 23h (hora de Portugal).
--
-- O pg_cron do Supabase trabalha em UTC. O agendamento cobre 06h–23h UTC
-- e a condição em hora de Lisboa deixa passar só 07:00–23:00 — fica
-- certo tanto no horário de inverno (UTC+0) como no de verão (UTC+1).
-- cron.schedule com o mesmo nome substitui o job, por isso correr isto
-- outra vez não duplica nada.
--
-- Histórico das execuções: Supabase → Integrations → Cron → presencas-agenda.
select cron.schedule(
  'presencas-agenda',
  '*/15 6-23 * * *',
  $cmd$
  do $$
  begin
    if (now() at time zone 'Europe/Lisbon')::time between time '07:00' and time '23:00:59' then
      perform public.marcar_presencas_agenda();
    end if;
  end $$;
  $cmd$
);
