-- Acrescenta a coluna "minuto" à escala, para suportar turnos de meia em
-- meia hora (:00 ou :30). Não apaga nem altera nada do que já existe: os
-- turnos já criados ficam automaticamente com minuto = 0 (à hora certa),
-- exatamente como já estavam.

alter table public.escalas
  add column if not exists minuto smallint not null default 0;

alter table public.escalas
  drop constraint if exists escalas_minuto_check;

alter table public.escalas
  add constraint escalas_minuto_check check (minuto in (0, 30));
