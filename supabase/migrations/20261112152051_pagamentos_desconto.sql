-- Desconto (€) aplicado à mensalidade deste pagamento — guardado à
-- parte do valor realmente pago, para o pedido de fatura conseguir
-- reduzir o preço da linha de mensalidade sem ter de adivinhar porque
-- é que o valor pago não bate com o preço de tabela do plano.
alter table public.pagamentos
  add column desconto numeric(10, 2) not null default 0;

alter table public.pagamentos
  add constraint pagamentos_desconto_nao_negativo check (desconto >= 0);
