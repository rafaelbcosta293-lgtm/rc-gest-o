-- Relatório comercial: uma visita marcada a uma lead pode ser um treino
-- experimental ou uma visita para conhecer as condições. Fica guardado no
-- evento da Agenda (tipo "Sessão experimental"); vazio nas marcações
-- antigas, que contam como treino experimental.
alter table public.agenda_eventos add column if not exists visita_tipo text;

alter table public.agenda_eventos drop constraint if exists agenda_eventos_visita_tipo_check;
alter table public.agenda_eventos add constraint agenda_eventos_visita_tipo_check
  check (visita_tipo is null or visita_tipo in ('Treino experimental', 'Visita de condições'));

comment on column public.agenda_eventos.visita_tipo is 'Só nas sessões experimentais: Treino experimental ou Visita de condições (vazio nas antigas = treino experimental).';
