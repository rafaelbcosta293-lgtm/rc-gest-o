-- Linha vazia para o regulamento interno poder ser editado com o
-- mesmo padrão genérico (guardarConfig) já usado para as outras
-- definições — "config" só suporta update, não insert, pela UI.
insert into public.config (chave, valor)
values ('regulamento', '')
on conflict (chave) do nothing;
