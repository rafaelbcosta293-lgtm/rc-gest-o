-- Morada do cliente: a localidade passa a ser escolhida da lista das
-- cidades, vilas e aldeias do país (lib/data/localidades.json), e com
-- ela ficam guardados o concelho e o distrito — para estatística por zona.
alter table public.clientes
  add column if not exists concelho text,
  add column if not exists distrito text;

comment on column public.clientes.cidade is 'Localidade (cidade, vila ou aldeia). Escolhida da lista do país, vem com concelho e distrito.';
comment on column public.clientes.concelho is 'Concelho da localidade (preenchido quando a localidade foi escolhida da lista).';
comment on column public.clientes.distrito is 'Distrito (ou ilha) da localidade (preenchido quando a localidade foi escolhida da lista).';
