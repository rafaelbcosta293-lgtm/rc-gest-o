-- Check-in no tablet do estúdio: o cliente escreve o seu nº de cliente e
-- fica registada a presença no treino (ou aula) que tem nesse momento.
--
-- Privacidade: o tablet abre uma página pública (sem login) identificada
-- por um link secreto do "posto". Essa página não lê nenhuma tabela —
-- só chama registar_checkin(), que corre do lado da base de dados e
-- responde apenas "registado, treino das 10:00" ou uma recusa genérica
-- (igual para número inexistente ou sem treino agora). Nunca devolve
-- nomes nem outros dados de clientes.

alter table public.presencas drop constraint if exists presencas_origem_check;
alter table public.presencas
  add constraint presencas_origem_check check (origem in ('manual', 'calendario', 'agenda', 'checkin'));
alter table public.presencas add column if not exists checkin_em timestamptz;
alter table public.aulas_inscricoes add column if not exists checkin_em timestamptz;

create table if not exists public.checkin_postos (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  nome text not null default 'Tablet da receção',
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  revogado_em timestamptz
);
create index if not exists checkin_postos_estudio_idx on public.checkin_postos (estudio_id);
alter table public.checkin_postos enable row level security;
create policy "gestao_checkin_postos" on public.checkin_postos for all
  using ((select e_gestao()) and ((select e_admin()) or estudio_id = any ((select estudios_acessiveis())::smallint[])))
  with check ((select e_gestao()) and ((select e_admin()) or estudio_id = any ((select estudios_acessiveis())::smallint[])));

-- Tentativas (só para travar quem experimente números ao calhas). Não
-- guarda o número escrito.
create table if not exists public.checkin_tentativas (
  id bigint generated always as identity primary key,
  posto_id uuid not null references public.checkin_postos(id) on delete cascade,
  ok boolean not null,
  criado_em timestamptz not null default now()
);
create index if not exists checkin_tentativas_posto_idx on public.checkin_tentativas (posto_id, criado_em desc);
alter table public.checkin_tentativas enable row level security;
-- Sem políticas: só a função abaixo (security definer) lhe mexe.

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
    -- Treino (PT) ou aula de grupo a decorrer: de 30 min antes do início até ao fim.
    select e.id, e.pt_id, e.hora_inicio into v_ev from public.agenda_eventos e
     where e.estudio_id = v_posto.estudio_id and e.cliente_id = v_cliente and e.tipo = 'Treino'
       and e.estado <> 'Cancelado' and e.data = v_hoje
       and v_agora between (e.data + e.hora_inicio) - interval '30 minutes' and (e.data + e.hora_inicio) + make_interval(mins => e.duracao_min)
     order by abs(extract(epoch from (v_agora - (e.data + e.hora_inicio)))) limit 1;

    select i.id as inscricao_id, i.estado, i.checkin_em, a.hora_inicio into v_aula
      from public.aulas_inscricoes i join public.aulas a on a.id = i.aula_id
     where a.estudio_id = v_posto.estudio_id and i.cliente_id = v_cliente and a.estado = 'Aberta'
       and i.estado in ('Inscrito', 'Presente') and a.data = v_hoje
       and v_agora between (a.data + a.hora_inicio) - interval '30 minutes' and (a.data + a.hora_inicio) + make_interval(mins => a.duracao_min)
     order by abs(extract(epoch from (v_agora - (a.data + a.hora_inicio)))) limit 1;

    if v_ev.id is not null and (v_aula.inscricao_id is null
        or abs(extract(epoch from (v_agora - (v_hoje + v_ev.hora_inicio)))) <= abs(extract(epoch from (v_agora - (v_hoje + v_aula.hora_inicio))))) then
      select id, origem, checkin_em into v_pres from public.presencas where cliente_id = v_cliente and data = v_hoje;
      if v_pres.id is null then
        insert into public.presencas (cliente_id, data, estado, pt_id, origem, agenda_evento_id, checkin_em)
        values (v_cliente, v_hoje, 'Presente', v_ev.pt_id, 'checkin', v_ev.id, now());
      elsif v_pres.origem = 'manual' then
        -- Marcada à mão por alguém da equipa: não se mexe no estado.
        v_repetido := v_pres.checkin_em is not null;
        update public.presencas set checkin_em = coalesce(checkin_em, now()) where id = v_pres.id;
      else
        v_repetido := v_pres.checkin_em is not null;
        update public.presencas
           set estado = 'Presente', origem = 'checkin', checkin_em = coalesce(checkin_em, now()),
               agenda_evento_id = coalesce(agenda_evento_id, v_ev.id), pt_id = coalesce(pt_id, v_ev.pt_id)
         where id = v_pres.id;
      end if;
      insert into public.checkin_tentativas (posto_id, ok) values (v_posto.id, true);
      return jsonb_build_object('estado', 'ok', 'tipo', 'treino', 'hora', to_char(v_ev.hora_inicio, 'HH24:MI'), 'repetido', v_repetido);
    elsif v_aula.inscricao_id is not null then
      v_repetido := v_aula.checkin_em is not null;
      update public.aulas_inscricoes
         set estado = 'Presente', checkin_em = coalesce(checkin_em, now()), atualizado_em = now()
       where id = v_aula.inscricao_id;
      insert into public.checkin_tentativas (posto_id, ok) values (v_posto.id, true);
      return jsonb_build_object('estado', 'ok', 'tipo', 'aula', 'hora', to_char(v_aula.hora_inicio, 'HH24:MI'), 'repetido', v_repetido);
    end if;
  end if;

  insert into public.checkin_tentativas (posto_id, ok) values (v_posto.id, false);
  return jsonb_build_object('estado', 'recusado');
end;
$$;

revoke all on function public.registar_checkin(text, text) from public;
grant execute on function public.registar_checkin(text, text) to anon, authenticated;
