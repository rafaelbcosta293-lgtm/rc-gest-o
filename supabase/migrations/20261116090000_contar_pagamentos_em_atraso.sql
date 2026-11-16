-- O número que aparece no menu, em Pagamentos: clientes (não inativos)
-- sem mensalidade em dia — a mesma conta dos "atrasados" da página de
-- Pagamentos. Uma função para o menu não ter de ir buscar a lista toda
-- em cada página. Respeita as regras de acesso de quem pergunta.
create or replace function public.contar_pagamentos_em_atraso(p_estudio smallint)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.clientes c
  where c.estudio_id = p_estudio
    and c.estado <> 'Inativo'::public.estado_cliente
    and not exists (
      select 1 from public.pagamentos p
      where p.cliente_id = c.id and p.anulado_em is null and p.mensalidade and p.valido_ate >= current_date
    );
$$;
