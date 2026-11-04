-- A agenda interna (cron /api/cron/presencas-agenda e a ação "contar como
-- realizado" da Agenda) grava presenças com origem 'agenda', mas a
-- restrição criada na 0016 só aceitava 'manual' e 'calendario' — esses
-- inserts falhavam todos com "violates check constraint
-- presencas_origem_check" (o cron devolvia 500 → curl saía com 22).
alter table public.presencas
  drop constraint if exists presencas_origem_check;
alter table public.presencas
  add constraint presencas_origem_check check (origem in ('manual', 'calendario', 'agenda'));
