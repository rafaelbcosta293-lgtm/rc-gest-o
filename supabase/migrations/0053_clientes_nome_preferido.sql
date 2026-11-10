-- Alguns clientes preferem ser tratados por um nome diferente do
-- primeiro nome oficial (ex.: "Rui Pedro Catarino" que prefere
-- "Pedro"). Quando preenchido, este nome sobrepõe-se ao primeiro nome
-- nas mensagens (SMS) e nos agendamentos (ver lib/data/clientes.ts:
-- primeiroNomeExibicao / nomeCurto).
alter table public.clientes add column nome_preferido text;
