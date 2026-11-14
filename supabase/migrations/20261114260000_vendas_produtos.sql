-- Venda de produtos (bar, merchandising…) registada pelos instrutores.
-- Fica em receitas_outras, com a categoria do produto: conta em euros
-- (Financeiro, fecho de caixa), nunca como cliente nem mensalidade.

alter table public.receitas_outras
  add column produto_id uuid references public.produtos(id) on delete set null,
  add column quantidade smallint not null default 1 check (quantidade > 0),
  add column cliente_id uuid references public.clientes(id) on delete set null;

alter table public.receitas_outras drop constraint if exists receitas_outras_origem_check;
alter table public.receitas_outras
  add constraint receitas_outras_origem_check check (origem in ('app', 'excel', 'ajuste', 'venda'));

create index receitas_outras_vendas_idx on public.receitas_outras (estudio_id, data) where origem = 'venda';

-- A equipa de cada estúdio regista, vê e anula as vendas do seu estúdio
-- (as restantes linhas — histórico do Excel e acertos — continuam só
-- para a administração).
create policy ler_vendas_estudio on public.receitas_outras for select
  using (origem = 'venda' and tenho_estudio(estudio_id));
create policy registar_vendas_estudio on public.receitas_outras for insert
  with check (origem = 'venda' and tenho_estudio(estudio_id));
create policy anular_vendas_estudio on public.receitas_outras for update
  using (origem = 'venda' and tenho_estudio(estudio_id))
  with check (origem = 'venda' and tenho_estudio(estudio_id));
