-- A vista pagamentos_ativos foi criada com a lista de colunas fixa,
-- antes de existir pagamentos.desconto — a Análise Financeira e o
-- Simulador leem o desconto daqui. A coluna nova vai no fim (é o que
-- "create or replace view" permite sem recriar a vista).
create or replace view public.pagamentos_ativos
with (security_invoker = true) as
select id, cliente_id, plano_id, valor, metodo, data_pagamento, valido_ate,
       inclui_inscricao, inclui_seguro, inclui_reativacao, nota, registado_por,
       criado_em, anulado_em, anulado_por, motivo_anulacao, desconto
from public.pagamentos
where anulado_em is null;
