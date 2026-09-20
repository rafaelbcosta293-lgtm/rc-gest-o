-- ============================================================
-- RC Gestão — Parte 5: Clientes e Treinos
-- Cria a base de dados partilhada pela equipa: perfis, clientes
-- e sessões de treino.
-- ============================================================

-- Estúdios (fixo por agora: Fátima e Leiria)
create type estudio_tipo as enum ('fatima', 'leiria');

-- ---------- Perfis da equipa ----------
-- Um perfil por pessoa. Criado automaticamente quando alguém cria conta.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  role text not null default 'pt' check (role in ('pt', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Equipa vê todos os perfis"
  on profiles for select
  to authenticated
  using (true);

create policy "Cada pessoa edita o seu próprio perfil"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Cria o perfil automaticamente a partir do email/nome dado no registo
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cria perfis para quem já tinha conta antes desta tabela existir
insert into public.profiles (id, nome)
select id, coalesce(raw_user_meta_data ->> 'nome', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- Função utilitária: mantém "updated_at" sempre atualizado
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Clientes ----------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  estudio estudio_tipo not null,
  pt uuid references profiles (id),
  objetivo text,
  frequencia smallint,
  alerta text not null default 'Nenhum'
    check (alerta in ('Nenhum', 'Lesão', 'Doença', 'Prova/Evento', 'Limitação')),
  detalhe text,
  evento text,
  evento_data date,
  nascimento date,
  telefone text,
  estado text not null default 'Ativo' check (estado in ('Ativo', 'Ex-cliente')),
  saiu_em date,
  motivo_saida text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clientes_set_updated_at
  before update on clientes
  for each row execute function public.set_updated_at();

alter table clientes enable row level security;

create policy "Equipa vê todos os clientes"
  on clientes for select to authenticated using (true);
create policy "Equipa cria clientes"
  on clientes for insert to authenticated with check (true);
create policy "Equipa edita clientes"
  on clientes for update to authenticated using (true);
create policy "Equipa apaga clientes"
  on clientes for delete to authenticated using (true);

-- ---------- Sessões de treino ----------
create table sessoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  data date not null,
  pt uuid references profiles (id),
  foco text,
  correu text check (correu in ('Muito bem', 'Bem', 'Razoável', 'Difícil', 'Interrompido')),
  exercicios jsonb not null default '[]'::jsonb,
  nota_proxima text,
  tipo_nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessoes_cliente_id_idx on sessoes (cliente_id);

create trigger sessoes_set_updated_at
  before update on sessoes
  for each row execute function public.set_updated_at();

alter table sessoes enable row level security;

create policy "Equipa vê todas as sessões"
  on sessoes for select to authenticated using (true);
create policy "Equipa cria sessões"
  on sessoes for insert to authenticated with check (true);
create policy "Equipa edita sessões"
  on sessoes for update to authenticated using (true);
create policy "Equipa apaga sessões"
  on sessoes for delete to authenticated using (true);
