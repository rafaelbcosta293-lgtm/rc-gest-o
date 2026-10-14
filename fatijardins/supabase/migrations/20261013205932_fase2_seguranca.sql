-- =====================================================================
-- Fatijardins — fase 2: reforço das regras na base de dados
-- (correções da revisão de segurança; a app já respeitava estas regras,
-- mas um utilizador podia contorná-las chamando a API diretamente)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fotos e assinaturas só podem apontar para ficheiros da pasta do
--    próprio trabalho (impede "fotos isco" que levariam uma chefia a
--    apagar ficheiros de outro trabalho).
-- ---------------------------------------------------------------------
alter table public.fotos
  add constraint fotos_caminho_do_trabalho
  check (trabalho_id is null or app.trabalho_do_caminho(caminho) = trabalho_id);

alter table public.registos_trabalho
  add constraint registos_assinatura_do_trabalho
  check (assinatura_caminho is null or app.trabalho_do_caminho(assinatura_caminho) = trabalho_id);

-- Nas fotos só se podem alterar a legenda e o momento, e só o autor ou
-- uma chefia.
revoke update on public.fotos from authenticated;
grant update (legenda, momento) on public.fotos to authenticated;

drop policy "fotos: alterar legenda" on public.fotos;
create policy "fotos: alterar legenda" on public.fotos
  for update to authenticated
  using (
    exists (select 1 from public.trabalhos t where t.id = fotos.trabalho_id)
    and ((select app.e_gerente_ou_chefe()) or colaborador_id = (select app.colaborador_atual()))
  )
  with check (
    exists (select 1 from public.trabalhos t where t.id = fotos.trabalho_id)
    and ((select app.e_gerente_ou_chefe()) or colaborador_id = (select app.colaborador_atual()))
  );

-- ---------------------------------------------------------------------
-- 2. Registo do trabalho: autor e data da assinatura definidos pela BD;
--    uma assinatura já feita só pode ser mudada/apagada por uma chefia.
-- ---------------------------------------------------------------------
create or replace function app.proteger_registo_trabalho()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_atual uuid := app.colaborador_atual();
  v_chefia boolean := app.e_gerente_ou_chefe();
begin
  if tg_op = 'UPDATE' then
    if new.trabalho_id is distinct from old.trabalho_id or new.created_at is distinct from old.created_at then
      raise exception 'Não é possível mudar o trabalho de um registo.' using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Quem grava é sempre o utilizador da sessão (pedidos sem sessão, como a seed, mantêm o valor).
  if v_atual is not null then
    new.colaborador_id := v_atual;
  end if;

  if tg_op = 'INSERT' then
    new.assinado_em := case when new.assinatura_caminho is null then null else now() end;
    if new.assinatura_caminho is null then
      new.assinatura_nome := null;
    end if;
  elsif new.assinatura_caminho is distinct from old.assinatura_caminho then
    if old.assinatura_caminho is not null and v_atual is not null and not v_chefia then
      raise exception 'Só o gerente ou o chefe de equipa podem alterar uma assinatura.'
        using errcode = 'insufficient_privilege';
    end if;
    new.assinado_em := case when new.assinatura_caminho is null then null else now() end;
    if new.assinatura_caminho is null then
      new.assinatura_nome := null;
    end if;
  elsif (new.assinatura_nome is distinct from old.assinatura_nome or new.assinado_em is distinct from old.assinado_em)
    and v_atual is not null then
    -- O nome e a data acompanham sempre a imagem da assinatura.
    raise exception 'O nome e a data da assinatura não se alteram à parte.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger registos_trabalho_proteger
  before insert or update on public.registos_trabalho
  for each row execute function app.proteger_registo_trabalho();

-- ---------------------------------------------------------------------
-- 3. Trabalhos: o colaborador só muda o estado, e só nas transições
--    previstas (iniciar um agendado; concluir um agendado ou em curso).
--    Ninguém muda o dia de um trabalho que já tem horas, registo ou fotos.
-- ---------------------------------------------------------------------
create or replace function app.trabalho_tem_atividade(p_trabalho uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.registos_horas where trabalho_id = p_trabalho)
      or exists (select 1 from public.registos_trabalho where trabalho_id = p_trabalho)
      or exists (select 1 from public.fotos where trabalho_id = p_trabalho);
$$;

create or replace function app.restringir_alteracoes_trabalho()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.perfil_atual() = 'colaborador' then
    if (to_jsonb(new) - 'estado' - 'updated_at') is distinct from (to_jsonb(old) - 'estado' - 'updated_at') then
      raise exception 'Só pode alterar o estado do trabalho.' using errcode = 'insufficient_privilege';
    end if;
    if new.estado is distinct from old.estado and not (
      (old.estado = 'agendado' and new.estado = 'em_curso')
      or (old.estado in ('agendado', 'em_curso') and new.estado = 'concluido')
    ) then
      raise exception 'Só pode iniciar ou concluir trabalhos agendados ou em curso.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.data is distinct from old.data and app.trabalho_tem_atividade(old.id) then
    raise exception 'Este trabalho já tem horas, registo ou fotos: não pode mudar de dia. Cancele-o e crie outro.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- As horas não perdem o trabalho a que estão imputadas: um trabalho com
-- horas não se apaga (cancela-se).
alter table public.registos_horas drop constraint registos_horas_trabalho_id_fkey;
alter table public.registos_horas
  add constraint registos_horas_trabalho_id_fkey
  foreign key (trabalho_id) references public.trabalhos (id) on delete restrict;

-- ---------------------------------------------------------------------
-- 4. O colaborador deixa de ver clientes/locais de trabalhos cancelados.
-- ---------------------------------------------------------------------
create or replace function app.clientes_dos_meus_trabalhos()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.cliente_id
  from public.trabalhos t
  where app.perfil_atual() = 'colaborador'
    and t.equipa_id = app.minha_equipa()
    and t.data = app.hoje()
    and t.estado <> 'cancelado';
$$;

create or replace function app.locais_dos_meus_trabalhos()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.local_id
  from public.trabalhos t
  where app.perfil_atual() = 'colaborador'
    and t.equipa_id = app.minha_equipa()
    and t.data = app.hoje()
    and t.estado <> 'cancelado';
$$;

-- ---------------------------------------------------------------------
-- 5. Localização da picagem com precisão de ~11 m (4 casas decimais):
--    chega para saber o local e não guarda mais do que o necessário.
-- ---------------------------------------------------------------------
create or replace function public.picar_entrada(
  p_trabalho_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.registos_horas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colaborador uuid := app.colaborador_atual();
  v_agora timestamptz := now();
  v_latitude numeric := round(p_latitude, 4);
  v_longitude numeric := round(p_longitude, 4);
  v_registo public.registos_horas;
begin
  if v_colaborador is null then
    raise exception 'Sem acesso à app.' using errcode = 'insufficient_privilege';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Localização incompleta.' using errcode = 'check_violation';
  end if;

  if p_trabalho_id is not null and not exists (
    select 1
    from public.trabalhos t
    where t.id = p_trabalho_id
      and t.data = app.hoje()
      and t.estado <> 'cancelado'
      and (
        app.e_gerente()
        or t.equipa_id = app.minha_equipa()
        or t.equipa_id in (select app.equipas_chefiadas())
      )
  ) then
    raise exception 'Este trabalho não é de hoje ou não pertence à sua equipa.' using errcode = 'insufficient_privilege';
  end if;

  perform app.fechar_entrada_esquecida(v_colaborador);

  -- Mudar de trabalho: fecha o período em curso e abre outro.
  update public.registos_horas
  set saida = v_agora, saida_latitude = v_latitude, saida_longitude = v_longitude
  where colaborador_id = v_colaborador and saida is null and entrada < v_agora;

  insert into public.registos_horas
    (colaborador_id, trabalho_id, entrada, entrada_latitude, entrada_longitude, origem)
  values
    (v_colaborador, p_trabalho_id, v_agora, v_latitude, v_longitude, 'picagem')
  returning * into v_registo;

  if p_trabalho_id is not null then
    update public.trabalhos set estado = 'em_curso' where id = p_trabalho_id and estado = 'agendado';
  end if;

  return v_registo;
end;
$$;

create or replace function public.picar_saida(
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.registos_horas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colaborador uuid := app.colaborador_atual();
  v_registo public.registos_horas;
begin
  if v_colaborador is null then
    raise exception 'Sem acesso à app.' using errcode = 'insufficient_privilege';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Localização incompleta.' using errcode = 'check_violation';
  end if;

  -- Entrada de hoje: fecha agora.
  update public.registos_horas
  set saida = greatest(now(), entrada + interval '1 second'),
      saida_latitude = round(p_latitude, 4),
      saida_longitude = round(p_longitude, 4)
  where colaborador_id = v_colaborador
    and saida is null
    and (entrada at time zone 'Europe/Lisbon')::date = app.hoje()
  returning * into v_registo;

  -- Entrada esquecida de outro dia: fecha no fim desse dia e marca "a rever".
  if v_registo.id is null then
    v_registo := app.fechar_entrada_esquecida(v_colaborador);
  end if;

  if v_registo.id is null then
    raise exception 'Não tem nenhuma entrada aberta.' using errcode = 'no_data_found';
  end if;

  return v_registo;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Storage: fotos comprimidas têm ~0,5 MB; 3 MB chegam com folga.
-- ---------------------------------------------------------------------
update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'fotos';

-- Permissões das funções novas.
revoke all on function app.proteger_registo_trabalho() from public;
revoke all on function app.trabalho_tem_atividade(uuid) from public;
grant execute on function app.proteger_registo_trabalho() to authenticated, service_role;
grant execute on function app.trabalho_tem_atividade(uuid) to authenticated, service_role;
