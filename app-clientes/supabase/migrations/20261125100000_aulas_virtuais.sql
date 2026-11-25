-- Aulas virtuais na app do cliente: a biblioteca de vídeos (cópia das
-- aulas publicadas na gestão) e quem lhes tem acesso (quem tem o serviço
-- "Aulas Virtuais" em dia). Como tudo o resto, só entra por sincronização
-- (a gestão é que escreve); o cliente só lê — e só se tiver acesso.

alter table public.contas add column aulas_virtuais boolean not null default false;

create table public.aulas_virtuais (
  id uuid primary key,
  titulo text not null,
  descricao text,
  categoria text not null,
  nivel text,
  duracao_min int,
  youtube_id text not null,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);

-- Informação geral da app, igual para todas as contas (ex.: quantas
-- aulas virtuais existem, para as mostrar a quem ainda não tem o serviço).
create table public.info (chave text primary key, valor text not null);

alter table public.aulas_virtuais enable row level security;
alter table public.info enable row level security;
revoke all on public.aulas_virtuais, public.info from anon, authenticated;
grant select on public.aulas_virtuais, public.info to authenticated;

create policy ver_aulas_virtuais on public.aulas_virtuais for select to authenticated
  using (exists (select 1 from public.contas c where c.id = (select auth.uid()) and c.ativa and c.aulas_virtuais));
create policy ver_info on public.info for select to authenticated using (true);

-- Substitui a biblioteca pelas aulas publicadas e marca as contas com
-- acesso (p_contas). Devolve quantas aulas mudaram.
create or replace function public.sync_substituir_aulas_virtuais(p_token text, p_aulas jsonb, p_contas uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform privado.exigir_token(p_token);
  insert into public.aulas_virtuais (id, titulo, descricao, categoria, nivel, duracao_min, youtube_id, ordem, atualizado_em)
  select a.id, a.titulo, a.descricao, a.categoria, a.nivel, a.duracao_min, a.youtube_id, coalesce(a.ordem, 0), now()
    from jsonb_populate_recordset(null::public.aulas_virtuais, coalesce(p_aulas, '[]'::jsonb)) a
  on conflict (id) do update
     set titulo = excluded.titulo, descricao = excluded.descricao, categoria = excluded.categoria, nivel = excluded.nivel,
         duracao_min = excluded.duracao_min, youtube_id = excluded.youtube_id, ordem = excluded.ordem, atualizado_em = now()
   where (public.aulas_virtuais.titulo, public.aulas_virtuais.descricao, public.aulas_virtuais.categoria, public.aulas_virtuais.nivel,
          public.aulas_virtuais.duracao_min, public.aulas_virtuais.youtube_id, public.aulas_virtuais.ordem)
         is distinct from
         (excluded.titulo, excluded.descricao, excluded.categoria, excluded.nivel, excluded.duracao_min, excluded.youtube_id, excluded.ordem);
  get diagnostics v_n = row_count;
  delete from public.aulas_virtuais a
   where not exists (select 1 from jsonb_array_elements(coalesce(p_aulas, '[]'::jsonb)) e where (e->>'id')::uuid = a.id);

  update public.contas c
     set aulas_virtuais = (c.id = any (coalesce(p_contas, '{}'::uuid[]))), atualizado_em = now()
   where c.aulas_virtuais is distinct from (c.id = any (coalesce(p_contas, '{}'::uuid[])));

  insert into public.info (chave, valor)
  values ('aulas_virtuais', (select count(*)::text from public.aulas_virtuais))
  on conflict (chave) do update set valor = excluded.valor where public.info.valor is distinct from excluded.valor;
  return v_n;
end $$;

revoke all on function public.sync_substituir_aulas_virtuais(text, jsonb, uuid[]) from public;
grant execute on function public.sync_substituir_aulas_virtuais(text, jsonb, uuid[]) to anon;
