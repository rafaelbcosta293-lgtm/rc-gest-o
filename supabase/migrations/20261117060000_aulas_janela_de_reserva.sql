-- Aulas de grupo, como nos ginásios: as reservas feitas pelo próprio
-- cliente (app) só abrem X horas antes da aula (48 h por omissão,
-- configurável por serviço) e fecham quando a aula começa. A equipa pode
-- inscrever a qualquer momento.
alter table public.servicos add column reserva_abre_horas smallint check (reserva_abre_horas between 1 and 336);
update public.servicos set reserva_abre_horas = 48 where formato = 'grupo';

-- inscrever_em_aula: igual à da fase 3, mais a janela de reserva para
-- origem = 'cliente' (ver migração aplicada "aulas_janela_de_reserva").
create or replace function public.inscrever_em_aula(p_aula uuid, p_cliente uuid, p_origem text default 'equipa')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_aula public.aulas%rowtype;
  v_ocupadas int;
  v_id uuid;
  v_inicio timestamptz;
  v_abre_horas smallint;
begin
  select * into v_aula from public.aulas where id = p_aula for update;
  if not found then raise exception 'Aula não encontrada.'; end if;
  if not public.tenho_estudio(v_aula.estudio_id) then raise exception 'Sem acesso a esta aula.'; end if;
  if v_aula.estado <> 'Aberta' then raise exception 'Esta aula foi cancelada.'; end if;
  if not exists (select 1 from public.clientes c where c.id = p_cliente and c.estudio_id = v_aula.estudio_id) then
    raise exception 'Cliente não encontrado neste estúdio.';
  end if;

  if coalesce(p_origem, 'equipa') = 'cliente' then
    v_inicio := (v_aula.data + v_aula.hora_inicio) at time zone 'Europe/Lisbon';
    select reserva_abre_horas into v_abre_horas from public.servicos where id = v_aula.servico_id;
    if now() >= v_inicio then raise exception 'Esta aula já começou.'; end if;
    if v_abre_horas is not null and now() < v_inicio - make_interval(hours => v_abre_horas) then
      raise exception 'As reservas para esta aula só abrem % horas antes.', v_abre_horas;
    end if;
  end if;

  select id into v_id from public.aulas_inscricoes
   where aula_id = p_aula and cliente_id = p_cliente and estado <> 'Cancelada';
  if v_id is not null then return v_id; end if;

  select count(*) into v_ocupadas from public.aulas_inscricoes where aula_id = p_aula and estado <> 'Cancelada';
  if v_ocupadas >= v_aula.lotacao then raise exception 'A aula está cheia (% de %).', v_ocupadas, v_aula.lotacao; end if;

  insert into public.aulas_inscricoes (aula_id, cliente_id, estado, origem)
  values (p_aula, p_cliente, 'Inscrito', coalesce(p_origem, 'equipa'))
  on conflict (aula_id, cliente_id) do update set estado = 'Inscrito', origem = excluded.origem, atualizado_em = now()
  returning id into v_id;
  return v_id;
end $$;
