-- Presenças automáticas da agenda interna, feitas dentro da própria base
-- de dados. O agendamento do GitHub Actions ("*/15") só disparava de ~6
-- em ~6 horas; o pg_cron do Supabase corre mesmo à hora marcada (ver
-- 0054_agendar_presencas_agenda.sql). O endpoint
-- /api/cron/presencas-agenda passa a só chamar esta função, por isso o
-- botão manual no GitHub e o pg_cron fazem exatamente o mesmo.
--
-- Quando um treino agendado termina sem ter sido desmarcado, conta como
-- presença do cliente e o evento passa a "Concluído". Nunca mexe numa
-- presença marcada à mão nem vinda do Google Calendar. Desmarcar depois
-- continua a desfazer esta presença (ações da Agenda), como antes.
create or replace function public.marcar_presencas_agenda()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  -- A agenda guarda data/hora em hora de Portugal — compara-se com a
  -- hora de Portugal (certo no horário de verão e no de inverno).
  v_agora timestamp := now() at time zone 'Europe/Lisbon';
  v_ev record;
  v_existente record;
  v_marcados int := 0;
  v_concluidos int := 0;
begin
  for v_ev in
    select id, cliente_id, pt_id, data
    from agenda_eventos
    where tipo = 'Treino'
      and estado = 'Agendado'
      and cliente_id is not null
      and data >= v_agora::date - 3   -- janela de segurança, como no endpoint
      and data + hora_inicio + make_interval(mins => duracao_min) <= v_agora
    order by data, hora_inicio
    for update skip locked            -- se alguém estiver a editar o evento agora, fica para a próxima volta
  loop
    select id, origem into v_existente
    from presencas
    where cliente_id = v_ev.cliente_id and data = v_ev.data;

    if not found then
      insert into presencas (cliente_id, data, estado, pt_id, origem, agenda_evento_id)
      values (v_ev.cliente_id, v_ev.data, 'Presente', v_ev.pt_id, 'agenda', v_ev.id);
      v_marcados := v_marcados + 1;
    elsif v_existente.origem = 'agenda' then
      update presencas
      set estado = 'Presente', agenda_evento_id = v_ev.id
      where id = v_existente.id;
      v_marcados := v_marcados + 1;
    end if;
    -- Já havia um registo manual (ou do Google Calendar) para este
    -- cliente/dia — nunca se mexe nele.

    update agenda_eventos set estado = 'Concluído' where id = v_ev.id;
    v_concluidos := v_concluidos + 1;
  end loop;

  return jsonb_build_object('ok', true, 'marcados', v_marcados, 'concluidos', v_concluidos);
end;
$$;

-- Só o servidor (service role) e o pg_cron a podem chamar — nunca a
-- Data API com a chave pública ou um utilizador com sessão iniciada.
revoke all on function public.marcar_presencas_agenda() from public, anon, authenticated;
grant execute on function public.marcar_presencas_agenda() to service_role;
