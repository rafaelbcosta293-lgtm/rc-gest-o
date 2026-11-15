-- A grelha de escalas vai até às 21:00, mas a regra antiga só aceitava
-- horas entre as 7 e as 20 — um turno marcado às 21:00 fazia falhar a
-- gravação da semana inteira. A grelha é que decide que horas mostra; a
-- base de dados só garante que é uma hora válida do dia.
alter table public.escalas
  drop constraint escalas_hora_check,
  add constraint escalas_hora_check check (hora >= 0 and hora <= 23);
