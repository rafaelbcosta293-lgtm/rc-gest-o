-- Morada do cliente — vem dos registos reais da equipa (Excel de
-- sócios), que sempre incluíram estes três campos separados.
alter table public.clientes
  add column if not exists morada text;
alter table public.clientes
  add column if not exists codigo_postal text;
alter table public.clientes
  add column if not exists cidade text;
