-- Aulas de grupo: mexer numa aula como num treino da Agenda — só esta,
-- esta e as seguintes, ou toda a série (o horário semanal que a gera).
--
-- * aulas_horario_saltos: as datas em que um horário NÃO deve voltar a
--   abrir aula (a aula desse dia foi apagada ou passou para outro dia).
--   Sem isto, o gerador recriava-a na vez seguinte.
-- * mudar_aula: muda dia/hora/duração (e, se dados, lotação e instrutor)
--   de uma aula, de "esta e as seguintes" ou de "todas as da série".
-- * apagar_aula: apaga com os mesmos três alcances. Aulas com inscritos
--   nunca são apagadas (ficam, para se avisar as pessoas e cancelar).
--
-- As duas funções correm com as permissões de quem chama (RLS): mexer no
-- horário semanal e apagar aulas continua a ser só da gestão.

create table public.aulas_horario_saltos (
  horario_id uuid not null references public.aulas_horario(id) on delete cascade,
  data date not null,
  criado_em timestamptz not null default now(),
  primary key (horario_id, data)
);

alter table public.aulas_horario_saltos enable row level security;
revoke all on public.aulas_horario_saltos from anon;
grant select, insert, delete on public.aulas_horario_saltos to authenticated;

create policy ver_saltos on public.aulas_horario_saltos for select
  using (exists (select 1 from public.aulas_horario h where h.id = horario_id and tenho_estudio(h.estudio_id)));
create policy criar_saltos on public.aulas_horario_saltos for insert
  with check (exists (select 1 from public.aulas_horario h where h.id = horario_id and tenho_estudio(h.estudio_id)));
create policy apagar_saltos on public.aulas_horario_saltos for delete
  using (e_gestao() and exists (select 1 from public.aulas_horario h where h.id = horario_id and tenho_estudio(h.estudio_id)));

create or replace function public.mudar_aula(
  p_aula uuid,
  p_escopo text,
  p_data date,
  p_hora time,
  p_duracao integer,
  p_lotacao integer default null,
  p_instrutor uuid default null,
  p_muda_instrutor boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  a public.aulas%rowtype;
  h public.aulas_horario%rowtype;
  x record;
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
  v_agora timestamp := now() at time zone 'Europe/Lisbon';
  v_delta integer;
  v_pivot date;
  v_novo uuid;
  v_dia smallint;
  v_ids uuid[];
  v_motivo text;
  v_retiradas integer := 0;
begin
  if p_escopo not in ('um', 'seguintes', 'serie') then raise exception 'Opção inválida.'; end if;
  if p_data is null or p_hora is null then raise exception 'Indica o dia e a hora.'; end if;
  if p_duracao is null or p_duracao < 10 or p_duracao > 240 then
    raise exception 'A duração tem de ficar entre 10 e 240 minutos.';
  end if;

  select * into a from public.aulas where id = p_aula for update;
  if not found then raise exception 'Aula não encontrada.'; end if;
  if a.horario_id is null then p_escopo := 'um'; end if;
  v_delta := p_data - a.data;

  -- ── Só esta aula ────────────────────────────────────────────────────
  if p_escopo = 'um' then
    if v_delta <> 0 then
      select d.motivo into v_motivo from public.dias_fechados d where d.estudio_id = a.estudio_id and d.data = p_data;
      if found then raise exception 'O estúdio está fechado nesse dia (%).', coalesce(v_motivo, 'dia fechado'); end if;
      if a.horario_id is not null then
        if exists (select 1 from public.aulas o where o.horario_id = a.horario_id and o.data = p_data and o.id <> a.id) then
          raise exception 'Já existe uma aula deste horário nesse dia.';
        end if;
        -- O dia de onde sai fica marcado, para o horário não voltar a abrir lá aula.
        insert into public.aulas_horario_saltos (horario_id, data) values (a.horario_id, a.data) on conflict do nothing;
      end if;
    end if;
    update public.aulas
      set data = p_data,
          hora_inicio = p_hora,
          duracao_min = p_duracao,
          lotacao = coalesce(p_lotacao, lotacao),
          instrutor_id = case when p_muda_instrutor then p_instrutor else instrutor_id end
      where id = a.id;
    return jsonb_build_object('estudio_id', a.estudio_id, 'mudadas', 1, 'retiradas', 0);
  end if;

  -- ── Esta e as seguintes / toda a série ──────────────────────────────
  if not e_gestao() then
    raise exception 'Só a gestão pode mudar o horário semanal — escolhe "Só esta".';
  end if;
  select * into h from public.aulas_horario where id = a.horario_id for update;
  if not found then raise exception 'O horário desta aula já não existe.'; end if;

  -- As aulas que mudam: a própria, e as outras da série ainda por
  -- acontecer (as que já passaram ou foram canceladas ficam como estão).
  select array_agg(o.id), min(o.data) into v_ids, v_pivot
    from public.aulas o
    where o.horario_id = h.id
      and (
        o.id = a.id
        or (
          o.estado <> 'Cancelada'
          and (p_escopo = 'serie' or o.data >= a.data)
          and (o.data + o.hora_inicio + make_interval(mins => o.duracao_min)) > v_agora
        )
      );

  if v_delta = 0 then
    -- Mesmo dia: muda só a hora/duração (e lotação/instrutor).
    if p_escopo = 'seguintes' and exists (select 1 from public.aulas o where o.horario_id = h.id and o.data < v_pivot) then
      -- Há aulas anteriores: o horário antigo acaba na véspera e nasce um novo.
      insert into public.aulas_horario (estudio_id, servico_id, dia_semana, hora_inicio, duracao_min, instrutor_id, lotacao, ativo, desde, ate)
        values (
          h.estudio_id, h.servico_id, h.dia_semana, p_hora, p_duracao,
          case when p_muda_instrutor then p_instrutor else h.instrutor_id end,
          coalesce(p_lotacao, h.lotacao), true, v_pivot, h.ate
        )
        returning id into v_novo;
      update public.aulas_horario set ate = v_pivot - 1, ativo = (v_pivot - 1 >= v_hoje) where id = h.id;
      insert into public.aulas_horario_saltos (horario_id, data)
        select v_novo, s.data from public.aulas_horario_saltos s where s.horario_id = h.id and s.data >= v_pivot
        on conflict do nothing;
      update public.aulas set horario_id = v_novo where horario_id = h.id and data >= v_pivot;
    else
      update public.aulas_horario
        set hora_inicio = p_hora,
            duracao_min = p_duracao,
            lotacao = coalesce(p_lotacao, lotacao),
            instrutor_id = case when p_muda_instrutor then p_instrutor else instrutor_id end
        where id = h.id;
    end if;
    update public.aulas
      set hora_inicio = p_hora,
          duracao_min = p_duracao,
          lotacao = coalesce(p_lotacao, lotacao),
          instrutor_id = case when p_muda_instrutor then p_instrutor else instrutor_id end
      where id = any(v_ids);
    return jsonb_build_object('estudio_id', a.estudio_id, 'mudadas', cardinality(v_ids), 'retiradas', 0);
  end if;

  -- Muda de dia: todas as aulas visadas deslocam-se o mesmo número de
  -- dias. As que iriam cair num dia fechado deixam de existir (o horário
  -- novo também não as abriria) — a não ser que tenham inscritos.
  select d.motivo into v_motivo from public.dias_fechados d where d.estudio_id = a.estudio_id and d.data = p_data;
  if found then raise exception 'O estúdio está fechado nesse dia (%).', coalesce(v_motivo, 'dia fechado'); end if;
  for x in
    select o.id, o.data from public.aulas o
      where o.id = any(v_ids) and o.id <> a.id
        and exists (select 1 from public.dias_fechados d where d.estudio_id = a.estudio_id and d.data = o.data + v_delta)
  loop
    if exists (select 1 from public.aulas_inscricoes i where i.aula_id = x.id and i.estado <> 'Cancelada') then
      raise exception 'A aula de % tem inscritos e passaria para %, dia em que o estúdio está fechado. Trata primeiro dessa aula.',
        to_char(x.data, 'DD/MM'), to_char(x.data + v_delta, 'DD/MM');
    end if;
    delete from public.aulas where id = x.id;
    v_ids := array_remove(v_ids, x.id);
    v_retiradas := v_retiradas + 1;
  end loop;

  v_dia := (((h.dia_semana - 1 + v_delta) % 7 + 7) % 7 + 1)::smallint;
  insert into public.aulas_horario (estudio_id, servico_id, dia_semana, hora_inicio, duracao_min, instrutor_id, lotacao, ativo, desde, ate)
    values (
      h.estudio_id, h.servico_id, v_dia, p_hora, p_duracao,
      case when p_muda_instrutor then p_instrutor else h.instrutor_id end,
      coalesce(p_lotacao, h.lotacao), true, v_pivot + v_delta, h.ate + v_delta
    )
    returning id into v_novo;
  insert into public.aulas_horario_saltos (horario_id, data)
    select v_novo, s.data + v_delta from public.aulas_horario_saltos s where s.horario_id = h.id and s.data >= v_pivot
    on conflict do nothing;
  update public.aulas
    set horario_id = v_novo,
        data = data + v_delta,
        hora_inicio = p_hora,
        duracao_min = p_duracao,
        lotacao = coalesce(p_lotacao, lotacao),
        instrutor_id = case when p_muda_instrutor then p_instrutor else instrutor_id end
    where id = any(v_ids);

  -- O horário antigo acaba na véspera da primeira aula que mudou (ou
  -- desaparece, se não lhe sobra nenhuma aula).
  if exists (select 1 from public.aulas o where o.horario_id = h.id) then
    update public.aulas_horario set ate = v_pivot - 1, ativo = (v_pivot - 1 >= v_hoje) where id = h.id;
  else
    delete from public.aulas_horario where id = h.id;
  end if;
  return jsonb_build_object('estudio_id', a.estudio_id, 'mudadas', cardinality(v_ids), 'retiradas', v_retiradas);
end $$;

create or replace function public.apagar_aula(p_aula uuid, p_escopo text) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  a public.aulas%rowtype;
  h public.aulas_horario%rowtype;
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
  v_inscritos integer;
  v_apagadas integer;
  v_ficaram integer;
begin
  if p_escopo not in ('um', 'seguintes', 'serie') then raise exception 'Opção inválida.'; end if;
  if not e_gestao() then
    raise exception 'Só a gestão pode apagar aulas. Podes cancelar a aula.';
  end if;
  select * into a from public.aulas where id = p_aula for update;
  if not found then raise exception 'Aula não encontrada.'; end if;
  if a.horario_id is null then p_escopo := 'um'; end if;

  if p_escopo = 'um' then
    select count(*) into v_inscritos from public.aulas_inscricoes i where i.aula_id = a.id and i.estado <> 'Cancelada';
    if v_inscritos > 0 then
      raise exception 'Esta aula tem % inscrito(s). Cancela a aula (fica registada e avisas as pessoas) ou remove primeiro as inscrições.', v_inscritos;
    end if;
    if a.horario_id is not null then
      insert into public.aulas_horario_saltos (horario_id, data) values (a.horario_id, a.data) on conflict do nothing;
    end if;
    delete from public.aulas where id = a.id;
    return jsonb_build_object('estudio_id', a.estudio_id, 'apagadas', 1, 'ficaram', 0);
  end if;

  select * into h from public.aulas_horario where id = a.horario_id for update;
  if not found then raise exception 'O horário desta aula já não existe.'; end if;

  if p_escopo = 'seguintes' then
    update public.aulas_horario set ate = a.data - 1, ativo = (a.data - 1 >= v_hoje) where id = h.id;
    with apagadas as (
      delete from public.aulas o
        where o.horario_id = h.id and o.data >= a.data
          and not exists (select 1 from public.aulas_inscricoes i where i.aula_id = o.id and i.estado <> 'Cancelada')
        returning 1
    )
    select count(*) into v_apagadas from apagadas;
    select count(*) into v_ficaram from public.aulas o where o.horario_id = h.id and o.data >= a.data;
  else
    update public.aulas_horario set ativo = false, ate = least(coalesce(ate, v_hoje - 1), v_hoje - 1) where id = h.id;
    with apagadas as (
      delete from public.aulas o
        where o.horario_id = h.id
          and not exists (select 1 from public.aulas_inscricoes i where i.aula_id = o.id and i.estado <> 'Cancelada')
        returning 1
    )
    select count(*) into v_apagadas from apagadas;
    select count(*) into v_ficaram from public.aulas o where o.horario_id = h.id and o.data >= v_hoje;
  end if;

  if not exists (select 1 from public.aulas o where o.horario_id = h.id) then
    delete from public.aulas_horario where id = h.id;
  end if;
  return jsonb_build_object('estudio_id', a.estudio_id, 'apagadas', v_apagadas, 'ficaram', v_ficaram);
end $$;

revoke all on function public.mudar_aula(uuid, text, date, time, integer, integer, uuid, boolean) from public, anon;
revoke all on function public.apagar_aula(uuid, text) from public, anon;
grant execute on function public.mudar_aula(uuid, text, date, time, integer, integer, uuid, boolean) to authenticated;
grant execute on function public.apagar_aula(uuid, text) to authenticated;
