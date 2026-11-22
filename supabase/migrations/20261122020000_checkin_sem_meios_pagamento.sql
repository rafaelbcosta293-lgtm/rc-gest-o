-- O tablet deixa de mostrar meios de pagamento: a resposta passa a levar só
-- a data em que a mensalidade expirou (o instrutor trata do pagamento).
create or replace function public.resposta_sem_mensalidade(p_estudio smallint, p_cliente uuid, p_servico smallint, p_tipo text, p_hora time)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'estado', 'sem_mensalidade',
    'tipo', p_tipo,
    'hora', to_char(p_hora, 'HH24:MI'),
    'expirou_em', (
      select to_char(p.valido_ate, 'DD/MM/YYYY')
        from pagamentos p
       where p.cliente_id = p_cliente and p.anulado_em is null and p.mensalidade and p.servico_id = p_servico
       order by p.valido_ate desc nulls last, p.data_pagamento desc
       limit 1));
$$;
revoke all on function public.resposta_sem_mensalidade(smallint, uuid, smallint, text, time) from public, anon, authenticated;
