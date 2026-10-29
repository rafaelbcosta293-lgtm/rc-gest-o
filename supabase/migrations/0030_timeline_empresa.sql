-- Fase 5, painel 4.6 (Timeline da empresa). "kpi_snapshots_daily" já
-- existia (migração 0027) mas nunca foi alimentada por nenhum cron —
-- fica a acumular a partir de agora (sem histórico anterior a
-- recuperar, por não existir).
--
-- Marcos manuais: o dono pode anotar acontecimentos (campanha, preço,
-- entrada/saída de PT, meta atingida) para cruzar com os resultados.
-- Gestão (admin/studio_manager), não administração só-de-dinheiro —
-- isto não é um dado financeiro.
create type tipo_marco_empresa as enum ('Campanha', 'Preço', 'Equipa', 'Meta', 'Outro');

create table public.marcos_empresa (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint references public.estudios(id), -- null = os dois estúdios
  tipo tipo_marco_empresa not null default 'Outro',
  titulo text not null,
  descricao text,
  data date not null,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);
create index marcos_empresa_data_idx on public.marcos_empresa (data);
alter table public.marcos_empresa enable row level security;
create policy "gerir_marcos_empresa" on public.marcos_empresa for all using (e_gestao()) with check (e_gestao());
grant select, insert, update, delete on public.marcos_empresa to authenticated;
