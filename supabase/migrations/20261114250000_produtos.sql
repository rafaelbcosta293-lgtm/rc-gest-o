-- Produtos (bar, merchandising…) com categorias, geridos na
-- Administração → Serviços / Produtos. Todos os membros da equipa os
-- podem ler; só a administração os altera.

create table public.produto_categorias (
  id smallint generated always as identity primary key,
  nome text not null unique check (length(trim(nome)) > 0),
  ordem smallint not null default 0,
  criado_em timestamptz not null default now()
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  categoria_id smallint not null references public.produto_categorias(id),
  nome text not null check (length(trim(nome)) > 0),
  valor numeric(10,2) not null default 0 check (valor >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index produtos_categoria_idx on public.produtos (categoria_id);

alter table public.produto_categorias enable row level security;
alter table public.produtos enable row level security;

create policy ler_produto_categorias on public.produto_categorias for select
  using ((select auth.uid()) is not null);
create policy gerir_produto_categorias on public.produto_categorias for all
  using ((select public.e_admin())) with check ((select public.e_admin()));
create policy ler_produtos on public.produtos for select
  using ((select auth.uid()) is not null);
create policy gerir_produtos on public.produtos for all
  using ((select public.e_admin())) with check ((select public.e_admin()));

insert into public.produto_categorias (nome, ordem) values ('Bar', 1), ('Merchandising', 2);
