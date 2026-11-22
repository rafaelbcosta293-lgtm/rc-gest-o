-- Base de dados da APP DO CLIENTE (projeto Supabase "rc-clientes").
--
-- Esta base de dados é totalmente separada da base da gestão:
--   * não tem nenhuma chave, endereço ou ligação para a gestão;
--   * só guarda uma CÓPIA do que cada cliente pode ver (as suas aulas,
--     treinos, presenças e avaliações) e uma caixa de "pedidos";
--   * quem escreve aqui é a gestão (no servidor dela), através das
--     funções sync_* protegidas por um token próprio — nunca o contrário.
-- Cada cliente só consegue ler as suas linhas (RLS) e só pode escrever
-- pedidos, que a gestão valida com as regras dela antes de mudar algo.

create extension if not exists pgcrypto with schema extensions;

-- Coisas internas (não expostas pela API).
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
grant usage on schema privado to supabase_auth_admin;

create table privado.config (chave text primary key, valor text not null);
create table privado.emails_autorizados (email text primary key, criado_em timestamptz not null default now());
create table privado.convites (
  conta_id uuid primary key,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0
);

-- Ninguém se regista sozinho: só existem as contas criadas pela gestão
-- (convite). Bloqueia qualquer registo público feito pela API de Auth.
create or replace function privado.so_contas_autorizadas()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from privado.emails_autorizados a where a.email = lower(new.email)) then
    raise exception 'Registo fechado.';
  end if;
  return new;
end $$;
revoke all on function privado.so_contas_autorizadas() from public, anon, authenticated;
grant execute on function privado.so_contas_autorizadas() to supabase_auth_admin;
drop trigger if exists so_contas_autorizadas on auth.users;
create trigger so_contas_autorizadas before insert on auth.users
  for each row execute function privado.so_contas_autorizadas();

-- ---------------------------------------------------------------------
-- Tabelas (cópia, por cliente)
-- ---------------------------------------------------------------------
create table public.contas (
  id uuid primary key references auth.users(id) on delete cascade,
  numero text not null unique,           -- nº de cliente, ex.: L25022
  estudio_slug text not null,
  estudio_nome text not null,
  nome text not null,                    -- só o nome preferido/primeiro nome
  ativa boolean not null default true,
  ativada_em timestamptz,                -- quando definiu a password
  atualizado_em timestamptz not null default now()
);

-- Aulas de grupo do estúdio: só horário, instrutor (primeiro nome) e
-- vagas — nunca quem está inscrito.
create table public.aulas (
  id uuid primary key,
  estudio_slug text not null,
  servico text not null,
  data date not null,
  hora_inicio time not null,
  duracao_min smallint not null,
  instrutor text,
  lotacao smallint not null,
  ocupadas smallint not null,
  estado text not null,
  reserva_abre_em timestamptz,
  cancelar_ate timestamptz,
  atualizado_em timestamptz not null default now()
);
create index aulas_estudio_data_idx on public.aulas (estudio_slug, data);

create table public.inscricoes (
  conta_id uuid not null references public.contas(id) on delete cascade,
  aula_id uuid not null references public.aulas(id) on delete cascade,
  estado text not null,
  primary key (conta_id, aula_id)
);

create table public.treinos (
  id uuid primary key,
  conta_id uuid not null references public.contas(id) on delete cascade,
  data date not null,
  hora_inicio time not null,
  duracao_min smallint not null,
  servico text,
  instrutor text,
  estado text not null
);
create index treinos_conta_data_idx on public.treinos (conta_id, data);

create table public.presencas (
  id uuid primary key,
  conta_id uuid not null references public.contas(id) on delete cascade,
  data date not null,
  estado text not null,
  tipo text not null
);
create index presencas_conta_data_idx on public.presencas (conta_id, data);

create table public.avaliacoes (
  id uuid primary key,
  conta_id uuid not null references public.contas(id) on delete cascade,
  data date not null,
  peso_kg numeric,
  altura_cm numeric,
  massa_gorda_pct numeric,
  massa_gorda_kg numeric,
  massa_magra_kg numeric,
  massa_muscular_kg numeric,
  gordura_visceral numeric,
  hidratacao_pct numeric,
  metabolismo_kcal integer,
  idade_metabolica integer,
  imc numeric,
  proxima_reavaliacao date
);
create index avaliacoes_conta_data_idx on public.avaliacoes (conta_id, data);

-- Pedidos do cliente: a gestão lê-os, valida-os e responde.
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null default auth.uid() references public.contas(id) on delete cascade,
  tipo text not null check (tipo in ('inscrever_aula', 'cancelar_aula', 'desmarcar_treino')),
  alvo uuid not null,
  nota text check (nota is null or char_length(nota) <= 300),
  estado text not null default 'pendente' check (estado in ('pendente', 'em_analise', 'aceite', 'recusado')),
  resposta text,
  criado_em timestamptz not null default now(),
  tratado_em timestamptz
);
create index pedidos_estado_idx on public.pedidos (estado, criado_em);
create index pedidos_conta_idx on public.pedidos (conta_id, criado_em desc);

-- ---------------------------------------------------------------------
-- Permissões: tudo fechado, só leitura das próprias linhas + pedidos.
-- ---------------------------------------------------------------------
alter table public.contas enable row level security;
alter table public.aulas enable row level security;
alter table public.inscricoes enable row level security;
alter table public.treinos enable row level security;
alter table public.presencas enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.pedidos enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.contas, public.aulas, public.inscricoes, public.treinos, public.presencas, public.avaliacoes, public.pedidos to authenticated;
grant insert (tipo, alvo, nota) on public.pedidos to authenticated;

-- Estúdio da conta com sessão iniciada (null se não tiver conta ativa).
create or replace function public.estudio_da_minha_conta()
returns text language sql stable security definer set search_path = '' as $$
  select c.estudio_slug from public.contas c where c.id = (select auth.uid()) and c.ativa
$$;
revoke all on function public.estudio_da_minha_conta() from public, anon;
grant execute on function public.estudio_da_minha_conta() to authenticated;

create policy ver_a_minha_conta on public.contas for select to authenticated using (id = (select auth.uid()));
create policy ver_aulas_do_meu_estudio on public.aulas for select to authenticated
  using (estudio_slug = (select public.estudio_da_minha_conta()));
create policy ver_as_minhas_inscricoes on public.inscricoes for select to authenticated
  using (conta_id = (select auth.uid()) and (select public.estudio_da_minha_conta()) is not null);
create policy ver_os_meus_treinos on public.treinos for select to authenticated
  using (conta_id = (select auth.uid()) and (select public.estudio_da_minha_conta()) is not null);
create policy ver_as_minhas_presencas on public.presencas for select to authenticated
  using (conta_id = (select auth.uid()) and (select public.estudio_da_minha_conta()) is not null);
create policy ver_as_minhas_avaliacoes on public.avaliacoes for select to authenticated
  using (conta_id = (select auth.uid()) and (select public.estudio_da_minha_conta()) is not null);
create policy ver_os_meus_pedidos on public.pedidos for select to authenticated
  using (conta_id = (select auth.uid()));
create policy criar_os_meus_pedidos on public.pedidos for insert to authenticated
  with check (conta_id = (select auth.uid()) and estado = 'pendente' and (select public.estudio_da_minha_conta()) is not null);

-- Validação dos pedidos ao entrar: alvo tem de ser da própria pessoa /
-- do seu estúdio; sem duplicados; limite de pedidos.
create or replace function privado.validar_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_estudio text;
  v_n int;
begin
  -- A gestão (sync) nunca insere pedidos; isto é só para os clientes.
  select c.estudio_slug into v_estudio from public.contas c where c.id = new.conta_id and c.ativa;
  if v_estudio is null then raise exception 'Conta inativa.'; end if;
  new.estado := 'pendente';
  new.resposta := null;
  new.tratado_em := null;
  new.criado_em := now();
  new.nota := nullif(trim(new.nota), '');

  if new.tipo in ('inscrever_aula', 'cancelar_aula') then
    if not exists (select 1 from public.aulas a where a.id = new.alvo and a.estudio_slug = v_estudio) then
      raise exception 'Aula não encontrada.';
    end if;
  elsif not exists (select 1 from public.treinos t where t.id = new.alvo and t.conta_id = new.conta_id) then
    raise exception 'Treino não encontrado.';
  end if;

  if exists (select 1 from public.pedidos p where p.conta_id = new.conta_id and p.alvo = new.alvo
              and p.tipo = new.tipo and p.estado in ('pendente', 'em_analise')) then
    raise exception 'Já tem este pedido em curso.';
  end if;
  select count(*) into v_n from public.pedidos p where p.conta_id = new.conta_id and p.criado_em > now() - interval '1 hour';
  if v_n >= 30 then raise exception 'Demasiados pedidos. Tente mais tarde.'; end if;
  return new;
end $$;
revoke all on function privado.validar_pedido() from public, anon, authenticated;
create trigger validar_pedido before insert on public.pedidos
  for each row execute function privado.validar_pedido();

-- ---------------------------------------------------------------------
-- Ativação da conta (o cliente define a password com o código do SMS).
-- ---------------------------------------------------------------------
create or replace function privado.email_da_conta(p_numero text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(coalesce(p_numero, ''), '[^A-Za-z0-9]', '', 'g')) || '@clientes.rc-app.invalid'
$$;

-- Devolve: ok | invalido | expirado | password_curta
create or replace function public.ativar_conta(p_numero text, p_codigo text, p_password text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_conta uuid;
  v_conv privado.convites%rowtype;
begin
  if coalesce(char_length(p_password), 0) < 8 or char_length(p_password) > 72 then return 'password_curta'; end if;
  select c.id into v_conta from public.contas c
   where upper(c.numero) = upper(regexp_replace(coalesce(p_numero, ''), '[^A-Za-z0-9]', '', 'g')) and c.ativa;
  if v_conta is null then return 'invalido'; end if;
  select * into v_conv from privado.convites where conta_id = v_conta for update;
  if not found or v_conv.tentativas >= 5 then return 'invalido'; end if;
  if v_conv.codigo_hash <> encode(extensions.digest(upper(trim(coalesce(p_codigo, ''))), 'sha256'), 'hex') then
    update privado.convites set tentativas = tentativas + 1 where conta_id = v_conta;
    return 'invalido';
  end if;
  if v_conv.expira_em < now() then return 'expirado'; end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         banned_until = null, updated_at = now()
   where id = v_conta;
  -- Termina sessões abertas noutros aparelhos.
  delete from auth.sessions where user_id = v_conta;
  delete from privado.convites where conta_id = v_conta;
  update public.contas set ativada_em = now(), atualizado_em = now() where id = v_conta;
  return 'ok';
end $$;
revoke all on function public.ativar_conta(text, text, text) from public;
grant execute on function public.ativar_conta(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções da sincronização (só a gestão, com o token).
-- ---------------------------------------------------------------------
create or replace function privado.exigir_token(p_token text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_token is null or not exists (
    select 1 from privado.config c
     where c.chave = 'sync_token_hash' and c.valor = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
end $$;
revoke all on function privado.exigir_token(text) from public, anon, authenticated;

-- Cria (ou reativa) a conta de um cliente e guarda um novo código de
-- ativação. Devolve o id da conta.
create or replace function public.sync_criar_conta(
  p_token text, p_numero text, p_estudio_slug text, p_estudio_nome text, p_nome text, p_codigo text, p_dias int default 7)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_numero text := upper(regexp_replace(coalesce(p_numero, ''), '[^A-Za-z0-9]', '', 'g'));
  v_email text := privado.email_da_conta(p_numero);
  v_id uuid;
begin
  perform privado.exigir_token(p_token);
  if v_numero = '' then raise exception 'Cliente sem número.'; end if;
  if coalesce(char_length(trim(p_codigo)), 0) < 6 then raise exception 'Código inválido.'; end if;

  select c.id into v_id from public.contas c where c.numero = v_numero;
  if v_id is null then
    select u.id into v_id from auth.users u where u.email = v_email;
  end if;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into privado.emails_autorizados (email) values (v_email) on conflict do nothing;
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
            extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf', 10)), now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
            '', '', '', '', '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now());
  else
    update auth.users set banned_until = null, updated_at = now() where id = v_id;
  end if;

  insert into public.contas (id, numero, estudio_slug, estudio_nome, nome, ativa)
  values (v_id, v_numero, p_estudio_slug, p_estudio_nome, coalesce(nullif(trim(p_nome), ''), 'Cliente'), true)
  on conflict (id) do update
     set numero = excluded.numero, estudio_slug = excluded.estudio_slug, estudio_nome = excluded.estudio_nome,
         nome = excluded.nome, ativa = true, atualizado_em = now();

  insert into privado.convites (conta_id, codigo_hash, expira_em, tentativas)
  values (v_id, encode(extensions.digest(upper(trim(p_codigo)), 'sha256'), 'hex'), now() + make_interval(days => greatest(1, least(coalesce(p_dias, 7), 30))), 0)
  on conflict (conta_id) do update set codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tentativas = 0;
  return v_id;
end $$;

-- Desativa uma conta: deixa de entrar e apaga a cópia dos dados.
create or replace function public.sync_desativar_conta(p_token text, p_conta uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_token(p_token);
  update public.contas set ativa = false, atualizado_em = now() where id = p_conta;
  update auth.users set banned_until = 'infinity', updated_at = now() where id = p_conta;
  delete from auth.sessions where user_id = p_conta;
  delete from privado.convites where conta_id = p_conta;
  delete from public.inscricoes where conta_id = p_conta;
  delete from public.treinos where conta_id = p_conta;
  delete from public.presencas where conta_id = p_conta;
  delete from public.avaliacoes where conta_id = p_conta;
end $$;

-- Substitui as aulas a partir de p_desde (as que deixaram de existir
-- desaparecem) e limpa as antigas.
create or replace function public.sync_substituir_aulas(p_token text, p_estudios text[], p_desde date, p_aulas jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform privado.exigir_token(p_token);
  insert into public.aulas (id, estudio_slug, servico, data, hora_inicio, duracao_min, instrutor, lotacao, ocupadas, estado, reserva_abre_em, cancelar_ate, atualizado_em)
  select a.id, a.estudio_slug, a.servico, a.data, a.hora_inicio, a.duracao_min, a.instrutor, a.lotacao, a.ocupadas, a.estado, a.reserva_abre_em, a.cancelar_ate, now()
    from jsonb_populate_recordset(null::public.aulas, coalesce(p_aulas, '[]'::jsonb)) a
  on conflict (id) do update
     set estudio_slug = excluded.estudio_slug, servico = excluded.servico, data = excluded.data, hora_inicio = excluded.hora_inicio,
         duracao_min = excluded.duracao_min, instrutor = excluded.instrutor, lotacao = excluded.lotacao, ocupadas = excluded.ocupadas,
         estado = excluded.estado, reserva_abre_em = excluded.reserva_abre_em, cancelar_ate = excluded.cancelar_ate, atualizado_em = now()
   where (public.aulas.estudio_slug, public.aulas.servico, public.aulas.data, public.aulas.hora_inicio, public.aulas.duracao_min,
          public.aulas.instrutor, public.aulas.lotacao, public.aulas.ocupadas, public.aulas.estado, public.aulas.reserva_abre_em, public.aulas.cancelar_ate)
         is distinct from
         (excluded.estudio_slug, excluded.servico, excluded.data, excluded.hora_inicio, excluded.duracao_min,
          excluded.instrutor, excluded.lotacao, excluded.ocupadas, excluded.estado, excluded.reserva_abre_em, excluded.cancelar_ate);
  get diagnostics v_n = row_count;
  delete from public.aulas a
   where (a.data >= p_desde and a.estudio_slug = any (p_estudios)
          and not exists (select 1 from jsonb_array_elements(coalesce(p_aulas, '[]'::jsonb)) e where (e->>'id')::uuid = a.id))
      or a.data < p_desde - 30
      or not (a.estudio_slug = any (p_estudios));
  return v_n;
end $$;

-- Substitui a cópia dos dados de várias contas de uma vez:
-- [{conta_id, inscricoes:[…], treinos:[…], presencas:[…], avaliacoes:[…]}]
create or replace function public.sync_substituir_dados(p_token text, p_dados jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_conta uuid;
  v_n int := 0;
begin
  perform privado.exigir_token(p_token);
  for v in select * from jsonb_array_elements(coalesce(p_dados, '[]'::jsonb)) loop
    v_conta := (v->>'conta_id')::uuid;
    if not exists (select 1 from public.contas c where c.id = v_conta and c.ativa) then continue; end if;

    delete from public.inscricoes where conta_id = v_conta;
    insert into public.inscricoes (conta_id, aula_id, estado)
    select v_conta, i.aula_id, i.estado from jsonb_populate_recordset(null::public.inscricoes, coalesce(v->'inscricoes', '[]'::jsonb)) i
     where exists (select 1 from public.aulas a where a.id = i.aula_id)
    on conflict do nothing;

    delete from public.treinos where conta_id = v_conta;
    insert into public.treinos (id, conta_id, data, hora_inicio, duracao_min, servico, instrutor, estado)
    select t.id, v_conta, t.data, t.hora_inicio, t.duracao_min, t.servico, t.instrutor, t.estado
      from jsonb_populate_recordset(null::public.treinos, coalesce(v->'treinos', '[]'::jsonb)) t
    on conflict (id) do nothing;

    delete from public.presencas where conta_id = v_conta;
    insert into public.presencas (id, conta_id, data, estado, tipo)
    select p.id, v_conta, p.data, p.estado, p.tipo from jsonb_populate_recordset(null::public.presencas, coalesce(v->'presencas', '[]'::jsonb)) p
    on conflict (id) do nothing;

    delete from public.avaliacoes where conta_id = v_conta;
    insert into public.avaliacoes (id, conta_id, data, peso_kg, altura_cm, massa_gorda_pct, massa_gorda_kg, massa_magra_kg, massa_muscular_kg,
                                   gordura_visceral, hidratacao_pct, metabolismo_kcal, idade_metabolica, imc, proxima_reavaliacao)
    select a.id, v_conta, a.data, a.peso_kg, a.altura_cm, a.massa_gorda_pct, a.massa_gorda_kg, a.massa_magra_kg, a.massa_muscular_kg,
           a.gordura_visceral, a.hidratacao_pct, a.metabolismo_kcal, a.idade_metabolica, a.imc, a.proxima_reavaliacao
      from jsonb_populate_recordset(null::public.avaliacoes, coalesce(v->'avaliacoes', '[]'::jsonb)) a
    on conflict (id) do nothing;

    if v ? 'nome' then
      update public.contas set nome = coalesce(nullif(trim(v->>'nome'), ''), nome), atualizado_em = now() where id = v_conta;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Pedidos por tratar (os mais antigos primeiro).
create or replace function public.sync_pedidos_pendentes(p_token text)
returns setof public.pedidos language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_token(p_token);
  return query select * from public.pedidos p where p.estado = 'pendente' order by p.criado_em limit 100;
end $$;

-- Respostas da gestão: [{id, estado, resposta}]
create or replace function public.sync_responder_pedidos(p_token text, p_respostas jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform privado.exigir_token(p_token);
  update public.pedidos p
     set estado = r.estado, resposta = left(r.resposta, 300), tratado_em = case when r.estado in ('aceite', 'recusado') then now() else p.tratado_em end
    from jsonb_to_recordset(coalesce(p_respostas, '[]'::jsonb)) as r(id uuid, estado text, resposta text)
   where p.id = r.id and r.estado in ('em_analise', 'aceite', 'recusado');
  get diagnostics v_n = row_count;
  delete from public.pedidos where criado_em < now() - interval '120 days';
  return v_n;
end $$;

-- Estado das contas (para a gestão mostrar "ativada" / "por ativar").
create or replace function public.sync_contas(p_token text)
returns table (id uuid, numero text, ativa boolean, ativada_em timestamptz, ultimo_acesso timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_token(p_token);
  return query select c.id, c.numero, c.ativa, c.ativada_em, u.last_sign_in_at
                 from public.contas c join auth.users u on u.id = c.id;
end $$;

revoke all on function public.sync_criar_conta(text, text, text, text, text, text, int) from public;
revoke all on function public.sync_desativar_conta(text, uuid) from public;
revoke all on function public.sync_substituir_aulas(text, text[], date, jsonb) from public;
revoke all on function public.sync_substituir_dados(text, jsonb) from public;
revoke all on function public.sync_pedidos_pendentes(text) from public;
revoke all on function public.sync_responder_pedidos(text, jsonb) from public;
revoke all on function public.sync_contas(text) from public;
-- A gestão chama-as com a chave pública + token (o token é que dá acesso).
grant execute on function public.sync_criar_conta(text, text, text, text, text, text, int) to anon;
grant execute on function public.sync_desativar_conta(text, uuid) to anon;
grant execute on function public.sync_substituir_aulas(text, text[], date, jsonb) to anon;
grant execute on function public.sync_substituir_dados(text, jsonb) to anon;
grant execute on function public.sync_pedidos_pendentes(text) to anon;
grant execute on function public.sync_responder_pedidos(text, jsonb) to anon;
grant execute on function public.sync_contas(text) to anon;
