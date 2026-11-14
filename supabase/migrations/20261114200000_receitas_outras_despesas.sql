-- Receitas sem cliente (Apoios, Bar, Merchandising, Nutrição, Osteopatia,
-- Pilates, Vouchers…) e despesas do negócio, para a Análise Financeira.
-- O histórico vem do Excel de cada estúdio ("origem" = 'excel'); os
-- ajustes de reconciliação ("origem" = 'ajuste') fazem os totais mensais
-- baterem com o "Volume de Negócio" e o "Total de Gastos" desse Excel.
-- Só a administração lê e escreve.

create table public.receitas_outras (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  data date not null,
  categoria text not null,
  descricao text,
  valor numeric(10,2) not null,
  metodo text,
  origem text not null default 'app' check (origem in ('app', 'excel', 'ajuste')),
  registado_por uuid references public.perfis(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  anulado_em timestamptz,
  anulado_por uuid references public.perfis(id),
  motivo_anulacao text
);
create index receitas_outras_estudio_data_idx on public.receitas_outras (estudio_id, data);

create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  data date not null,
  categoria text not null,
  subcategoria text,
  descricao text,
  valor numeric(10,2) not null,
  origem text not null default 'app' check (origem in ('app', 'excel', 'ajuste')),
  registado_por uuid references public.perfis(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  anulado_em timestamptz,
  anulado_por uuid references public.perfis(id),
  motivo_anulacao text
);
create index despesas_estudio_data_idx on public.despesas (estudio_id, data);

alter table public.receitas_outras enable row level security;
alter table public.despesas enable row level security;

create policy admin_receitas_outras on public.receitas_outras for all
  using ((select public.e_admin())) with check ((select public.e_admin()));
create policy admin_despesas on public.despesas for all
  using ((select public.e_admin())) with check ((select public.e_admin()));
