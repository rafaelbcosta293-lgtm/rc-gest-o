-- Check-in no tablet de quem não tem a mensalidade em dia (pagamento de
-- mensalidade, não anulado, desse serviço, válido até hoje ou depois — a
-- mesma regra dos "pagamentos em atraso"):
-- - a presença fica registada na mesma, assinalada (mensalidade_em_falta),
--   para ninguém ter de barrar o cliente à porta;
-- - o tablet mostra uma mensagem simpática e os meios de pagamento do
--   estúdio (definidos pela gestão; dados do negócio, não do cliente);
-- - a tentativa fica guardada com o cliente para a equipa do estúdio ver
--   um aviso na app e registar o pagamento.

alter table public.presencas add column if not exists mensalidade_em_falta boolean not null default false;
alter table public.checkin_tentativas add column if not exists cliente_id uuid references public.clientes(id) on delete cascade;
alter table public.checkin_tentativas add column if not exists servico_id smallint references public.servicos(id);
alter table public.checkin_tentativas add column if not exists motivo text;

-- A equipa de cada estúdio vê as tentativas dos tablets desse estúdio.
drop policy if exists "gestao_le_checkin_tentativas" on public.checkin_tentativas;
drop policy if exists "equipa_le_checkin_tentativas" on public.checkin_tentativas;
create policy "equipa_le_checkin_tentativas" on public.checkin_tentativas for select
  using (exists (
    select 1 from public.checkin_postos p
     where p.id = checkin_tentativas.posto_id
       and ((select e_admin()) or p.estudio_id = any ((select estudios_acessiveis())::smallint[]))));

create or replace function public.mensalidade_em_dia(p_cliente uuid, p_servico smallint, p_dia date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pagamentos p
     where p.cliente_id = p_cliente and p.anulado_em is null and p.mensalidade
       and p.servico_id = p_servico and p.valido_ate >= p_dia
  );
$$;
revoke all on function public.mensalidade_em_dia(uuid, smallint, date) from public, anon, authenticated;

-- Meios de pagamento do estúdio (config: pagamento_<campo>_<slug>).
create or replace function public.dados_pagamento_estudio(p_estudio smallint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'mbway', (select nullif(trim(valor), '') from config where chave = 'pagamento_mbway_' || e.slug),
    'iban', (select nullif(trim(valor), '') from config where chave = 'pagamento_iban_' || e.slug),
    'titular', (select nullif(trim(valor), '') from config where chave = 'pagamento_titular_' || e.slug),
    'nota', (select nullif(trim(valor), '') from config where chave = 'pagamento_nota_' || e.slug))
  from estudios e where e.id = p_estudio;
$$;
revoke all on function public.dados_pagamento_estudio(smallint) from public, anon, authenticated;

create or replace function public.registar_checkin(p_token text, p_numero text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posto public.checkin_postos%rowtype;
  v_digitos text := regexp_replace(coalesce(p_numero, ''), '\D', '', 'g');
  v_agora timestamp := (now() at time zone 'Europe/Lisbon');
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
  v_cliente uuid;
  v_n int;
  v_ev record;
  v_aula record;
  v_pres record;
  v_repetido boolean := false;
  v_falta boolean := false;
  v_slug text;
  v_pag jsonb;
begin
  select * into v_posto from public.checkin_postos where token = p_token and revogado_em is null;
  if not found then
    return jsonb_build_object('estado', 'posto_invalido');
  end if;

  -- 5 recusas seguidas no último minuto → espera 1 minuto.
  select count(*) into v_n from public.checkin_tentativas t
   where t.posto_id = v_posto.id and not t.ok and t.criado_em > now() - interval '1 minute'
     and t.criado_em > coalesce((select max(criado_em) from public.checkin_tentativas s where s.posto_id = v_posto.id and s.ok), '-infinity');
  if v_n >= 5 then
    return jsonb_build_object('estado', 'bloqueado');
  end if;

  delete from public.checkin_tentativas where criado_em < now() - interval '2 days';

  if length(v_digitos) between 1 and 10 then
    select count(*), min(c.id::text)::uuid into v_n, v_cliente from public.clientes c
     where c.estudio_id = v_posto.estudio_id
       and regexp_replace(coalesce(c.numero_socio, ''), '\D', '', 'g') = v_digitos;
    if v_n <> 1 then v_cliente := null; end if;
  end if;

  if v_cliente is not null then
    -- Treino (PT) ou aula de grupo: de 30 min antes do início até 30 min depois do fim
    -- (há quem só registe ao sair).
    select e.id, e.pt_id, e.hora_inicio, e.servico_id into v_ev from public.agenda_eventos e
     where e.estudio_id = v_posto.estudio_id and e.cliente_id = v_cliente and e.tipo = 'Treino'
       and e.estado <> 'Cancelado' and e.data = v_hoje
       and v_agora between (e.data + e.hora_inicio) - interval '30 minutes' and (e.data + e.hora_inicio) + make_interval(mins => e.duracao_min + 30)
     order by abs(extract(epoch from (v_agora - (e.data + e.hora_inicio)))) limit 1;

    select i.id as inscricao_id, i.estado, i.checkin_em, a.hora_inicio, a.servico_id into v_aula
      from public.aulas_inscricoes i join public.aulas a on a.id = i.aula_id
     where a.estudio_id = v_posto.estudio_id and i.cliente_id = v_cliente and a.estado = 'Aberta'
       and i.estado in ('Inscrito', 'Presente') and a.data = v_hoje
       and v_agora between (a.data + a.hora_inicio) - interval '30 minutes' and (a.data + a.hora_inicio) + make_interval(mins => a.duracao_min + 30)
     order by abs(extract(epoch from (v_agora - (a.data + a.hora_inicio)))) limit 1;

    if v_ev.id is not null and (v_aula.inscricao_id is null
        or abs(extract(epoch from (v_agora - (v_hoje + v_ev.hora_inicio)))) <= abs(extract(epoch from (v_agora - (v_hoje + v_aula.hora_inicio))))) then
      v_falta := not public.mensalidade_em_dia(v_cliente, v_ev.servico_id, v_hoje);
      select id, origem, checkin_em into v_pres from public.presencas where cliente_id = v_cliente and data = v_hoje;
      if v_pres.id is null then
        insert into public.presencas (cliente_id, data, estado, pt_id, origem, agenda_evento_id, checkin_em, mensalidade_em_falta)
        values (v_cliente, v_hoje, 'Presente', v_ev.pt_id, 'checkin', v_ev.id, now(), v_falta);
      elsif v_pres.origem = 'manual' then
        -- Marcada à mão por alguém da equipa: não se mexe no estado.
        v_repetido := v_pres.checkin_em is not null;
        update public.presencas set checkin_em = coalesce(checkin_em, now()), mensalidade_em_falta = v_falta where id = v_pres.id;
      else
        v_repetido := v_pres.checkin_em is not null;
        update public.presencas
           set estado = 'Presente', origem = 'checkin', checkin_em = coalesce(checkin_em, now()),
               agenda_evento_id = coalesce(agenda_evento_id, v_ev.id), pt_id = coalesce(pt_id, v_ev.pt_id),
               mensalidade_em_falta = v_falta
         where id = v_pres.id;
      end if;
      if v_falta then
        insert into public.checkin_tentativas (posto_id, ok, cliente_id, servico_id, motivo)
        values (v_posto.id, true, v_cliente, v_ev.servico_id, 'sem_mensalidade');
        return jsonb_build_object('estado', 'ok', 'tipo', 'treino', 'hora', to_char(v_ev.hora_inicio, 'HH24:MI'),
          'repetido', v_repetido, 'mensalidade_em_falta', true, 'pagamento', public.dados_pagamento_estudio(v_posto.estudio_id));
      end if;
      insert into public.checkin_tentativas (posto_id, ok) values (v_posto.id, true);
      return jsonb_build_object('estado', 'ok', 'tipo', 'treino', 'hora', to_char(v_ev.hora_inicio, 'HH24:MI'), 'repetido', v_repetido);
    elsif v_aula.inscricao_id is not null then
      v_falta := not public.mensalidade_em_dia(v_cliente, v_aula.servico_id, v_hoje);
      v_repetido := v_aula.checkin_em is not null;
      update public.aulas_inscricoes
         set estado = 'Presente', checkin_em = coalesce(checkin_em, now()), atualizado_em = now()
       where id = v_aula.inscricao_id;
      if v_falta then
        insert into public.checkin_tentativas (posto_id, ok, cliente_id, servico_id, motivo)
        values (v_posto.id, true, v_cliente, v_aula.servico_id, 'sem_mensalidade');
        return jsonb_build_object('estado', 'ok', 'tipo', 'aula', 'hora', to_char(v_aula.hora_inicio, 'HH24:MI'),
          'repetido', v_repetido, 'mensalidade_em_falta', true, 'pagamento', public.dados_pagamento_estudio(v_posto.estudio_id));
      end if;
      insert into public.checkin_tentativas (posto_id, ok) values (v_posto.id, true);
      return jsonb_build_object('estado', 'ok', 'tipo', 'aula', 'hora', to_char(v_aula.hora_inicio, 'HH24:MI'), 'repetido', v_repetido);
    end if;
  end if;

  insert into public.checkin_tentativas (posto_id, ok) values (v_posto.id, false);
  return jsonb_build_object('estado', 'recusado');
end;
$$;

