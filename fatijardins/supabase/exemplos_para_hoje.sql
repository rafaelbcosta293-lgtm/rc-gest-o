-- =====================================================================
-- Põe os dados de exemplo no dia de hoje.
-- Os trabalhos de exemplo foram criados para o dia em que a seed correu;
-- este script desloca-os (e as horas, os prazos dos equipamentos, as
-- manutenções e os movimentos de stock de exemplo) para que os trabalhos
-- "de hoje" voltem a ser de hoje, mantendo o último e o próximo dia útil
-- e os alertas à mesma distância. Só mexe nos dados de exemplo (ids fixos da seed) e
-- pode correr-se as vezes que for preciso (no SQL Editor: colar e Run).
-- NÃO use numa base de dados com dados reais da empresa.
-- =====================================================================
begin;

create temporary table desvio on commit drop as
select
  current_date - t.data as dias,
  -- dia das horas de exemplo (o trabalho 006 é do último dia útil)
  (select data from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000006') as dia_das_horas
from public.trabalhos t
where t.id = 'b0000000-0000-4000-8000-000000000001';

-- As horas e os registos de exemplo impedem mudar o dia dos trabalhos (regra da
-- base de dados): a regra fica desligada só dentro desta transação.
alter table public.trabalhos disable trigger trabalhos_restringir_colaborador;

update public.trabalhos
set data = data + (select dias from desvio)
where id::text like 'b0000000-0000-4000-8000-%'
   or serie_id = 'f0000000-0000-4000-8000-000000000001';

alter table public.trabalhos enable trigger trabalhos_restringir_colaborador;

-- Horas de exemplo: as dos trabalhos de exemplo e as sem trabalho do mesmo dia
-- (à mesma hora de Lisboa, mesmo que a mudança de hora fique pelo meio).
update public.registos_horas h
set entrada = ((h.entrada at time zone 'Europe/Lisbon') + make_interval(days => d.dias)) at time zone 'Europe/Lisbon',
    saida = ((h.saida at time zone 'Europe/Lisbon') + make_interval(days => d.dias)) at time zone 'Europe/Lisbon'
from desvio d
where d.dias <> 0
  and h.colaborador_id::text like 'c0000000-0000-4000-8000-%'
  and (
    h.trabalho_id::text like 'b0000000-0000-4000-8000-%'
    or (h.trabalho_id is null and (h.entrada at time zone 'Europe/Lisbon')::date = d.dia_das_horas)
  );

-- Fase 4: prazos dos equipamentos, manutenções e compras de exemplo andam
-- os mesmos dias; as saídas dos materiais ficam no dia do seu trabalho.
update public.equipamentos e
set data_aquisicao = e.data_aquisicao + d.dias,
    proxima_revisao = e.proxima_revisao + d.dias,
    seguro_ate = e.seguro_ate + d.dias,
    ipo_ate = e.ipo_ate + d.dias
from desvio d
where d.dias <> 0 and e.id::text like 'a4000000-0000-4000-8000-%';

update public.manutencoes_equipamento m
set data = m.data + d.dias
from desvio d
where d.dias <> 0 and m.equipamento_id::text like 'a4000000-0000-4000-8000-%';

update public.movimentos_stock m
set data = m.data + d.dias
from desvio d
where d.dias <> 0 and m.registo_material_id is null and m.consumivel_id::text like 'a5000000-0000-4000-8000-%';

update public.movimentos_stock m
set data = t.data
from public.trabalhos t
where m.registo_material_id is not null and m.trabalho_id = t.id and m.data <> t.data;

select dias as dias_deslocados from desvio;
commit;
