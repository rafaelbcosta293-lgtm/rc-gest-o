-- Aulas virtuais: uma biblioteca de aulas em vídeo (YouTube não listado)
-- que os clientes veem na app do cliente, gerida na Coordenação.
--
-- * Serviço novo "Aulas Virtuais" (formato "virtual"): tem planos e
--   pagamentos próprios, como o Pilates; só vê as aulas quem tiver este
--   serviço Ativo (em dia).
-- * aulas_virtuais: os vídeos. Não são de um estúdio — valem para todos.
--   A equipa pode vê-los; só a gestão (Coordenação/Administração) mexe.

alter table public.servicos drop constraint servicos_formato_check;
alter table public.servicos add constraint servicos_formato_check
  check (formato = any (array['individual'::text, 'grupo'::text, 'virtual'::text]));

insert into public.servicos (id, chave, nome, formato, ordem, ativo)
  select (select coalesce(max(id), 0) + 1 from public.servicos), 'virtuais', 'Aulas Virtuais', 'virtual',
         (select coalesce(max(ordem), 0) + 1 from public.servicos), true
  where not exists (select 1 from public.servicos where chave = 'virtuais');

create table public.aulas_virtuais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  descricao text,
  categoria text not null default 'Geral' check (char_length(btrim(categoria)) between 1 and 40),
  nivel text check (nivel in ('Iniciação', 'Intermédio', 'Avançado')),
  duracao_min smallint check (duracao_min between 1 and 600),
  -- O código do vídeo no YouTube (os 11 caracteres da ligação).
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- Só as publicadas chegam à app do cliente.
  publicada boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

alter table public.aulas_virtuais enable row level security;
revoke all on public.aulas_virtuais from anon;
grant select, insert, update, delete on public.aulas_virtuais to authenticated;

create policy ver_aulas_virtuais on public.aulas_virtuais for select using ((select e_equipa()));
create policy gerir_aulas_virtuais on public.aulas_virtuais for all using (e_gestao()) with check (e_gestao());
