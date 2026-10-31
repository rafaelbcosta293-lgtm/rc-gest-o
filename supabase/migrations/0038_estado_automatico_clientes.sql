alter table public.clientes
  add column estado_automatico boolean not null default true;

comment on column public.clientes.estado_automatico is
  'false quando o estado foi alterado manualmente — a transição automática por falta de pagamento deixa de tocar neste cliente até um novo pagamento o reativar.';
