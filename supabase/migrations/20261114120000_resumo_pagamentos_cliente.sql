-- Um registo por cliente com o último pagamento (por data) e a validade
-- mais distante — o que as listas de pagamentos/presenças, o MRR e os
-- crons precisam, sem descarregar o histórico inteiro (que já passa as
-- 1000 linhas que a API devolve por pedido). security_invoker para as
-- regras de acesso (RLS) de pagamentos e clientes continuarem a valer.
create index if not exists pagamentos_cliente_data_ativos_idx
  on public.pagamentos (cliente_id, data_pagamento desc, criado_em desc)
  where anulado_em is null;

create index if not exists pagamentos_data_pagamento_idx
  on public.pagamentos (data_pagamento)
  where anulado_em is null;

create or replace view public.v_resumo_pagamentos_cliente
with (security_invoker = true) as
select distinct on (p.cliente_id)
  p.cliente_id,
  c.estudio_id,
  p.data_pagamento as ultimo_pagamento,
  p.valido_ate as ultimo_valido_ate,
  p.valor as ultimo_valor,
  max(p.valido_ate) over (partition by p.cliente_id) as validade_maxima
from public.pagamentos p
join public.clientes c on c.id = p.cliente_id
where p.anulado_em is null
order by p.cliente_id, p.data_pagamento desc, p.criado_em desc;

grant select on public.v_resumo_pagamentos_cliente to authenticated, service_role;

-- Receita já somada por estúdio e mês, para o Financeiro mostrar o
-- histórico todo (anos) sem descarregar cada pagamento.
create or replace view public.v_receita_mensal
with (security_invoker = true) as
select
  c.estudio_id,
  date_trunc('month', p.data_pagamento)::date as mes,
  sum(p.valor) as receita,
  sum(p.desconto) as descontos,
  count(*) as pagamentos
from public.pagamentos p
join public.clientes c on c.id = p.cliente_id
where p.anulado_em is null
group by 1, 2;

grant select on public.v_receita_mensal to authenticated, service_role;
