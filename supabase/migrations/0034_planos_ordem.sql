-- Ordem escolhida pelo dono para os serviços/produtos, em vez de ficar
-- sempre ordenado por preço. Preenchida já com a ordem atual (por
-- valor), para nada saltar visualmente na primeira vez que a página
-- carrega com a coluna nova.
alter table public.planos add column ordem smallint;

with numerados as (
  select id, row_number() over (order by valor) as rn
  from public.planos
)
update public.planos p
set ordem = numerados.rn
from numerados
where numerados.id = p.id;

alter table public.planos alter column ordem set not null;
alter table public.planos alter column ordem set default 0;
