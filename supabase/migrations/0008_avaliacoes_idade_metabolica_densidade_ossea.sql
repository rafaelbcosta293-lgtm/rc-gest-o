-- Duas novas métricas manuais da avaliação física (vêm da balança de
-- bioimpedância, não dá para calcular a partir de peso/altura/% gordura
-- como o IMC e a massa gorda em kg).

alter table public.avaliacoes
  add column if not exists idade_metabolica integer;

alter table public.avaliacoes
  add column if not exists densidade_ossea numeric;
