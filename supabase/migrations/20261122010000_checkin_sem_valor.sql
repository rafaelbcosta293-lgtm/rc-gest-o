-- O tablet deixa de mostrar o valor da mensalidade (só a data em que
-- expirou): a resposta deixa de o enviar.
create or replace function public.resposta_sem_mensalidade(p_estudio smallint, p_cliente uuid, p_servico smallint, p_tipo text, p_hora time)
returns jsonb language sql stable security definer set search_path = public
as $$
  with ult as (
    select p.valido_ate
      from pagamentos p
     where p.cliente_id = p_cliente and p.anulado_em is null and p.mensalidade and p.servico_id = p_servico
     order by p.valido_ate desc nulls last, p.data_pagamento desc
     limit 1
  ), cfg as (
    select e.slug from estudios e where e.id = p_estudio
  )
  select jsonb_build_object(
    'estado', 'sem_mensalidade',
    'tipo', p_tipo,
    'hora', to_char(p_hora, 'HH24:MI'),
    'expirou_em', (select to_char(valido_ate, 'DD/MM/YYYY') from ult),
    'pagamento', jsonb_build_object(
      'mbway', (select nullif(trim(valor), '') from config, cfg where chave = 'pagamento_mbway_' || cfg.slug),
      'iban', (select nullif(trim(valor), '') from config, cfg where chave = 'pagamento_iban_' || cfg.slug),
      'titular', (select nullif(trim(valor), '') from config, cfg where chave = 'pagamento_titular_' || cfg.slug),
      'link', (select nullif(trim(valor), '') from config, cfg where chave = 'pagamento_link_' || cfg.slug),
      'nota', (select nullif(trim(valor), '') from config, cfg where chave = 'pagamento_nota_' || cfg.slug)));
$$;
revoke all on function public.resposta_sem_mensalidade(smallint, uuid, smallint, text, time) from public, anon, authenticated;
