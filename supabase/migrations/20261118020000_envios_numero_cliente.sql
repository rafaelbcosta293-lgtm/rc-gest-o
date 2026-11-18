-- Registo do SMS único "o seu nº de cliente é…" (check-in no tablet),
-- para nunca se enviar duas vezes ao mesmo cliente e para se poder
-- retomar o envio se o telemóvel-gateway falhar a meio.
create table if not exists public.envios_numero_cliente (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  enviado_em timestamptz not null default now()
);
alter table public.envios_numero_cliente enable row level security;
create policy "admin_le_envios_numero_cliente" on public.envios_numero_cliente for select using ((select e_admin()));
