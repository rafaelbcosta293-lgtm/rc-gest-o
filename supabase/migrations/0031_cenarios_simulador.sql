-- Simulador "E se…" (secção 6.3) — só Administração, nunca
-- e_gestao(): ao contrário dos outros painéis desta fase, os inputs e
-- resultados guardados aqui são hipóteses de preços/custos/margens,
-- claramente financeiro.
create table public.cenarios_simulador (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  entradas jsonb not null,
  resultados jsonb not null,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);
alter table public.cenarios_simulador enable row level security;
create policy "admin_cenarios_simulador" on public.cenarios_simulador for all using (e_admin()) with check (e_admin());
grant select, insert, update, delete on public.cenarios_simulador to authenticated;
