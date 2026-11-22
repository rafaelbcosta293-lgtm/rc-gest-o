-- App do cliente — lado da GESTÃO.
--
-- A app do cliente tem a sua própria base de dados (projeto Supabase
-- "rc-clientes"), sem qualquer acesso a esta. Quem faz a ponte é só o
-- servidor da gestão (rota /api/cron/app-clientes), que:
--   1. lê os pedidos dos clientes (inscrever/cancelar aula, desmarcar
--      treino), valida-os com as regras daqui e responde;
--   2. copia para lá, de cada cliente com conta, só o que é dele.
-- Esta migração guarda quem tem conta, o registo dos pedidos e as regras
-- de inscrição pela app. O pg_cron chama a rota de 20 em 20 segundos.

create table public.app_clientes_contas (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  conta_id uuid not null unique,
  numero text not null,
  estudio_id smallint not null references public.estudios(id),
  convidado_em timestamptz not null default now(),
  convidado_por uuid references public.perfis(id) on delete set null,
  ativada_em timestamptz,
  ultimo_acesso timestamptz,
  ativa boolean not null default true,
  desativada_em timestamptz,
  hash_dados text,
  sincronizado_em timestamptz
);
create index app_clientes_contas_sync_idx on public.app_clientes_contas (ativa, sincronizado_em);

-- Contas a desligar na app (cliente apagado na gestão). A sincronização
-- desativa-as lá e apaga a linha daqui.
create table public.app_clientes_contas_a_remover (
  conta_id uuid primary key,
  criado_em timestamptz not null default now()
);
create or replace function public.app_clientes_conta_apagada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_clientes_contas_a_remover (conta_id) values (old.conta_id) on conflict do nothing;
  return old;
end $$;
revoke all on function public.app_clientes_conta_apagada() from public, anon, authenticated;
create trigger trg_app_clientes_conta_apagada after delete on public.app_clientes_contas
  for each row execute function public.app_clientes_conta_apagada();

-- Registo de todos os pedidos vindos da app (e caixa de entrada dos
-- pedidos de desmarcação de treinos, que a equipa decide).
create table public.app_clientes_pedidos (
  id uuid primary key,                      -- o mesmo id do pedido na app
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estudio_id smallint not null references public.estudios(id),
  tipo text not null check (tipo in ('inscrever_aula', 'cancelar_aula', 'desmarcar_treino')),
  alvo uuid not null,
  nota text,
  criado_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  estado text not null check (estado in ('em_analise', 'aceite', 'recusado')),
  resposta text,
  tratado_em timestamptz,
  tratado_por uuid references public.perfis(id) on delete set null,
  -- a resposta final já foi enviada para a app?
  respondido_app boolean not null default false
);
create index app_clientes_pedidos_estudio_idx on public.app_clientes_pedidos (estudio_id, estado);
create index app_clientes_pedidos_por_responder_idx on public.app_clientes_pedidos (respondido_app) where not respondido_app;

alter table public.app_clientes_contas enable row level security;
alter table public.app_clientes_contas_a_remover enable row level security;
alter table public.app_clientes_pedidos enable row level security;

-- A equipa do estúdio vê; só o servidor (service role) escreve, exceto
-- a decisão sobre um pedido de desmarcação.
create policy equipa_ve_contas_app on public.app_clientes_contas for select to authenticated
  using (public.tenho_estudio(estudio_id));
create policy equipa_ve_pedidos_app on public.app_clientes_pedidos for select to authenticated
  using (public.tenho_estudio(estudio_id));
create policy equipa_decide_pedidos_app on public.app_clientes_pedidos for update to authenticated
  using (public.tenho_estudio(estudio_id) and estado = 'em_analise')
  with check (public.tenho_estudio(estudio_id));
revoke all on public.app_clientes_contas_a_remover from anon, authenticated;

-- ---------------------------------------------------------------------
-- Regras dos pedidos feitos pela app (só o servidor as chama).
-- ---------------------------------------------------------------------

-- Inscrição pela app: as mesmas regras da equipa (lotação, aula aberta)
-- mais as do cliente — janela de reserva, aula ainda não começou e
-- mensalidade desse serviço em dia.
create or replace function public.inscrever_em_aula_app(p_aula uuid, p_cliente uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_aula public.aulas%rowtype;
  v_ocupadas int;
  v_id uuid;
  v_inicio timestamptz;
  v_abre_horas smallint;
  v_servico text;
begin
  select * into v_aula from public.aulas where id = p_aula for update;
  if not found then raise exception 'Aula não encontrada.'; end if;
  if v_aula.estado <> 'Aberta' then raise exception 'Esta aula foi cancelada.'; end if;
  if not exists (select 1 from public.clientes c where c.id = p_cliente and c.estudio_id = v_aula.estudio_id) then
    raise exception 'Aula de outro estúdio.';
  end if;

  v_inicio := (v_aula.data + v_aula.hora_inicio) at time zone 'Europe/Lisbon';
  select reserva_abre_horas, nome into v_abre_horas, v_servico from public.servicos where id = v_aula.servico_id;
  if now() >= v_inicio then raise exception 'Esta aula já começou.'; end if;
  if v_abre_horas is not null and now() < v_inicio - make_interval(hours => v_abre_horas) then
    raise exception 'As reservas para esta aula só abrem % horas antes.', v_abre_horas;
  end if;
  if not public.mensalidade_em_dia(p_cliente, v_aula.servico_id, (now() at time zone 'Europe/Lisbon')::date) then
    raise exception 'Para reservar, a mensalidade de % tem de estar em dia. Fale com a equipa do estúdio.', coalesce(v_servico, 'este serviço');
  end if;

  select id into v_id from public.aulas_inscricoes
   where aula_id = p_aula and cliente_id = p_cliente and estado <> 'Cancelada';
  if v_id is not null then return v_id; end if;

  select count(*) into v_ocupadas from public.aulas_inscricoes where aula_id = p_aula and estado <> 'Cancelada';
  if v_ocupadas >= v_aula.lotacao then raise exception 'A aula está cheia.'; end if;

  insert into public.aulas_inscricoes (aula_id, cliente_id, estado, origem, criado_por)
  values (p_aula, p_cliente, 'Inscrito', 'cliente', null)
  on conflict (aula_id, cliente_id) do update set estado = 'Inscrito', origem = 'cliente', atualizado_em = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.inscrever_em_aula_app(uuid, uuid) from public, anon, authenticated;
grant execute on function public.inscrever_em_aula_app(uuid, uuid) to service_role;

-- Cancelar a inscrição pela app: até 2 horas antes da aula (depois disso,
-- fala-se com a equipa).
create or replace function public.cancelar_inscricao_app(p_aula uuid, p_cliente uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_aula public.aulas%rowtype;
  v_n int;
begin
  select * into v_aula from public.aulas where id = p_aula;
  if not found then raise exception 'Aula não encontrada.'; end if;
  if now() > ((v_aula.data + v_aula.hora_inicio) at time zone 'Europe/Lisbon') - interval '2 hours' then
    raise exception 'Já não é possível cancelar pela app (faltam menos de 2 horas). Fale com a equipa do estúdio.';
  end if;
  update public.aulas_inscricoes set estado = 'Cancelada', atualizado_em = now()
   where aula_id = p_aula and cliente_id = p_cliente and estado = 'Inscrito';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Não está inscrito nesta aula.'; end if;
end $$;
revoke all on function public.cancelar_inscricao_app(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancelar_inscricao_app(uuid, uuid) to service_role;

-- Uma sincronização de cada vez (o pg_cron chama de 20 em 20 s; se uma
-- demorar mais, a seguinte não começa por cima dela).
create table public.app_clientes_sync (
  id smallint primary key default 1 check (id = 1),
  em_curso_ate timestamptz,
  ultimo_inicio timestamptz,
  ultimo_fim timestamptz,
  ultimo_erro text
);
insert into public.app_clientes_sync (id) values (1) on conflict do nothing;
alter table public.app_clientes_sync enable row level security;
create policy equipa_ve_sync_app on public.app_clientes_sync for select to authenticated using (public.e_equipa());

create or replace function public.app_clientes_reclamar_sync(p_segundos int default 55)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.app_clientes_sync
     set em_curso_ate = now() + make_interval(secs => p_segundos), ultimo_inicio = now()
   where id = 1 and (em_curso_ate is null or em_curso_ate < now());
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;
revoke all on function public.app_clientes_reclamar_sync(int) from public, anon, authenticated;
grant execute on function public.app_clientes_reclamar_sync(int) to service_role;
