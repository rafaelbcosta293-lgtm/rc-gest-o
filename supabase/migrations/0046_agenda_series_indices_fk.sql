-- Índices em falta nas foreign keys de agenda_series (apontado pelo
-- linter de performance do Supabase) — sem isto, apagar/atualizar um
-- cliente, perfil de PT ou utilizador força uma leitura completa desta
-- tabela para verificar referências.
create index if not exists agenda_series_cliente_id_idx on public.agenda_series (cliente_id);
create index if not exists agenda_series_criado_por_idx on public.agenda_series (criado_por);
create index if not exists agenda_series_pt_id_idx on public.agenda_series (pt_id);
