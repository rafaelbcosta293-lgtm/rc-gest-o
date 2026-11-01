create type genero_cliente as enum ('Masculino', 'Feminino');

-- Nullable de propósito: sem valor = desconhecido, não assume nada.
-- Usado só para escolher "estimado"/"estimada" nas mensagens
-- automáticas (ver {estimado} em lib/data/aniversarios.ts).
alter table public.clientes add column genero genero_cliente;
