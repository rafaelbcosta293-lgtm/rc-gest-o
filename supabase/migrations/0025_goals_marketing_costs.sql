-- Objetivos por estúdio/mês/métrica.
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  ano smallint not null,
  mes smallint not null check (mes between 1 and 12),
  metrica text not null,
  meta numeric not null,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now(),
  unique (estudio_id, ano, mes, metrica)
);
alter table public.goals enable row level security;
create policy "gerir_goals" on public.goals for all using (tenho_estudio(estudio_id)) with check (tenho_estudio(estudio_id));
grant select, insert, update, delete on public.goals to authenticated;

-- Custo de marketing por origem/campanha, para o CAC — só Administração
-- (o CAC por origem é explicitamente "só na Administração" na
-- especificação, tal como qualquer outro valor em €).
create table public.marketing_costs (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  ano smallint not null,
  mes smallint not null check (mes between 1 and 12),
  origem text not null,
  campanha text,
  custo numeric not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.marketing_costs enable row level security;
create policy "admin_marketing_costs" on public.marketing_costs for all using (e_admin()) with check (e_admin());
grant select, insert, update, delete on public.marketing_costs to authenticated;
