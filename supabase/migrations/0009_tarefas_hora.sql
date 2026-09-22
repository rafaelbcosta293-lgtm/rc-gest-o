-- Hora do dia a que a tarefa deve ser feita (opcional) — usada para
-- ordenar a lista do dia da mais urgente (mais cedo) para a menos
-- urgente, e para mostrar as tarefas na vista de semana.
alter table public.tarefas_diarias
  add column if not exists hora time;
