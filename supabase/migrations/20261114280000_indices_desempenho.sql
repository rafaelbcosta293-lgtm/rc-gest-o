-- Índices para consultas frequentes que liam a tabela inteira.
-- Auditoria: a lista ordena pelos mais recentes (35 mil linhas).
create index if not exists auditoria_criado_em_idx on public.auditoria (criado_em desc);
-- Presenças: os resumos do mês/ano filtram por intervalo de datas.
create index if not exists presencas_data_idx on public.presencas (data);
-- Chaves estrangeiras das vendas de produtos.
create index if not exists receitas_outras_cliente_idx on public.receitas_outras (cliente_id) where cliente_id is not null;
create index if not exists receitas_outras_produto_idx on public.receitas_outras (produto_id) where produto_id is not null;
