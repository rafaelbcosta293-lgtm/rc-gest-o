-- Treinos em simultâneo: várias pessoas na mesma marcação. Cada pessoa
-- continua a ser uma linha própria em agenda_eventos (nada que já lia
-- esta tabela por cliente_id precisa de mudar), mas as linhas que
-- pertencem ao mesmo treino partilham um grupo_id — mover, redimensionar,
-- desmarcar, reativar ou apagar o treino aplica-se a todas de uma vez.
alter table public.agenda_eventos add column grupo_id uuid;

create index agenda_eventos_grupo_idx on public.agenda_eventos (grupo_id);
