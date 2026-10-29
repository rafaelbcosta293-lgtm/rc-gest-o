-- Fotografia diária das métricas principais, para a timeline histórica
-- (secção 4.6) não depender de recalcular o passado sempre que é
-- aberta. Pode incluir valores financeiros (MRR, etc.) no jsonb, por
-- isso a leitura fica limitada a quem já gere o estúdio (admin ou
-- studio_manager) — mais restrito do que o resto, de propósito, até a
-- Fase 5 definir exatamente o que entra em "metricas" e se compensa
-- separar num snapshot não-financeiro à parte.
create table public.kpi_snapshots_daily (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  data date not null,
  metricas jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  unique (estudio_id, data)
);
alter table public.kpi_snapshots_daily enable row level security;
create policy "ler_kpi_snapshots" on public.kpi_snapshots_daily for select using (e_gestao());
grant select on public.kpi_snapshots_daily to authenticated;
