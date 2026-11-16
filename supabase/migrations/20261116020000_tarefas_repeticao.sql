-- Tarefas que se repetem (rotinas do estúdio: regar plantas, desinfetar
-- máquinas, verificar chamadas…). Funciona como no Asana: ao concluir
-- uma tarefa que se repete, nasce a seguinte com o próximo prazo.
alter table public.tarefas
  -- Dias da semana em que se repete: 1 = segunda … 7 = domingo.
  add column if not exists repete_dias smallint[],
  -- Repete todos os meses, no mesmo dia do mês (ou no último dia, se o
  -- prazo for o último dia do mês).
  add column if not exists repete_mensal boolean not null default false;

alter table public.tarefas drop constraint if exists tarefas_repete_dias_validos;
alter table public.tarefas
  add constraint tarefas_repete_dias_validos
  check (repete_dias is null or (cardinality(repete_dias) > 0 and repete_dias <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]));

-- Uma coisa ou outra, e uma tarefa que se repete tem sempre prazo (é a
-- partir dele que se calcula a vez seguinte).
alter table public.tarefas drop constraint if exists tarefas_repeticao_coerente;
alter table public.tarefas
  add constraint tarefas_repeticao_coerente
  check (not (repete_dias is not null and repete_mensal) and ((repete_dias is null and not repete_mensal) or prazo is not null));
