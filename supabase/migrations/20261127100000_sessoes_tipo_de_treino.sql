-- Tipo de treino do plano (membros inferiores, cardio, funcional, …):
-- o seletor de exercícios mostra primeiro os exercícios desse tipo.
-- Texto livre na base de dados; a lista de tipos está em
-- lib/data/tiposTreino.ts.
alter table public.sessoes add column if not exists tipo_treino text;
