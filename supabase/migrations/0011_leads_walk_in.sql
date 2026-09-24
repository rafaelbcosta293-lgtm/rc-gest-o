-- Distingue leads que apareceram sem marcação ("walk-in") dos que
-- vieram por uma visita agendada — usado no painel de Marketing da
-- Coordenação para separar as duas origens de fecho.
alter table public.leads
  add column if not exists walk_in boolean not null default false;
