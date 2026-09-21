-- Tarefas diárias passam a poder repetir-se diária, semanal, mensal ou
-- anualmente (como no Asana), em vez de aparecerem sempre todos os dias.
-- "proxima_data" é a próxima vez que a tarefa deve aparecer como por
-- fazer; ao ser marcada como feita avança sozinha consoante a
-- recorrência (ver ação marcarFeita).

alter table public.tarefas_diarias
  add column if not exists recorrencia text not null default 'Diária';

alter table public.tarefas_diarias
  drop constraint if exists tarefas_diarias_recorrencia_check;

alter table public.tarefas_diarias
  add constraint tarefas_diarias_recorrencia_check
  check (recorrencia in ('Diária', 'Semanal', 'Mensal', 'Anual'));

alter table public.tarefas_diarias
  add column if not exists proxima_data date not null default current_date;
