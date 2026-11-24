-- Ficha do cliente: morada em campos separados (para estatística) e
-- identificação. "morada" passa a ser só a rua; o número fica à parte.
alter table public.clientes
  add column if not exists morada_numero text,
  add column if not exists pais text,
  add column if not exists nacionalidade text,
  add column if not exists cartao_cidadao text,
  add column if not exists profissao text;

comment on column public.clientes.morada is 'Rua (a morada completa junta morada_numero, codigo_postal, cidade e pais).';
comment on column public.clientes.morada_numero is 'Número da porta, andar, etc.';
