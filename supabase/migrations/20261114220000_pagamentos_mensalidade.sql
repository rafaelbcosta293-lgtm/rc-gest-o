-- Só as mensalidades contam para os clientes (ativos, pagantes, em dia,
-- novos/perdidos, churn). Seguros, inscrições, reativações, sessões
-- avulsas, nutrição e outros produtos contam só em euros.
alter table public.pagamentos add column mensalidade boolean not null default true;

-- Histórico: o "pagamento do seguro" registado na app e as linhas do
-- Excel que não cobrem nenhum período (seguro, inscrição, reativação,
-- avulsos — importadas com válido até = dia do pagamento).
do $$
begin
  alter table public.pagamentos disable trigger restringir_edicao_pagamentos;
  update public.pagamentos set mensalidade = false
  where nota = 'Pagamento do seguro'
     or (nota like 'Importado do histórico%' and valido_ate <= data_pagamento);
  alter table public.pagamentos enable trigger restringir_edicao_pagamentos;
end $$;

create index pagamentos_mensalidade_cliente_idx on public.pagamentos (cliente_id, data_pagamento)
  where mensalidade and anulado_em is null;

create or replace view public.pagamentos_ativos
with (security_invoker = true) as
select id, cliente_id, plano_id, valor, metodo, data_pagamento, valido_ate,
       inclui_inscricao, inclui_seguro, inclui_reativacao, nota, registado_por,
       criado_em, anulado_em, anulado_por, motivo_anulacao, desconto, mensalidade
from public.pagamentos
where anulado_em is null;

-- Último pagamento e validade de cada cliente: só mensalidades.
create or replace view public.v_resumo_pagamentos_cliente
with (security_invoker = true) as
select distinct on (p.cliente_id) p.cliente_id,
    c.estudio_id,
    p.data_pagamento as ultimo_pagamento,
    p.valido_ate as ultimo_valido_ate,
    p.valor as ultimo_valor,
    max(p.valido_ate) over (partition by p.cliente_id) as validade_maxima
from public.pagamentos p
join public.clientes c on c.id = p.cliente_id
where p.anulado_em is null and p.mensalidade
order by p.cliente_id, p.data_pagamento desc, p.criado_em desc;

-- "Em dia": só uma mensalidade válida conta.
create or replace view public.v_estado_pagamento
with (security_invoker = true) as
select c.id as cliente_id,
    c.estudio_id,
    c.nome,
    max(p.valido_ate) as valido_ate,
    coalesce(max(p.valido_ate) >= current_date, false) as em_dia
from public.clientes c
left join public.pagamentos p on p.cliente_id = c.id and p.anulado_em is null and p.mensalidade
where c.estado = 'Ativo'::estado_cliente and tenho_estudio(c.estudio_id)
group by c.id, c.estudio_id, c.nome;

-- Receita (€) de tudo; contagem de mensalidades à parte.
create or replace view public.v_receita_mensal
with (security_invoker = true) as
select c.estudio_id,
    date_trunc('month', p.data_pagamento::timestamp with time zone)::date as mes,
    sum(p.valor) as receita,
    sum(p.desconto) as descontos,
    count(*) as pagamentos,
    count(*) filter (where p.mensalidade) as mensalidades
from public.pagamentos p
join public.clientes c on c.id = p.cliente_id
where p.anulado_em is null
group by c.estudio_id, (date_trunc('month', p.data_pagamento::timestamp with time zone)::date);
