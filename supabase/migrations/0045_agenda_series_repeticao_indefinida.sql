-- Modelo da recorrência "indefinida" (semanal/quinzenal até eu
-- interromper): uma linha por série, com os dados que o cron precisa
-- para continuar a gerar ocorrências à frente sem olhar para nenhuma
-- linha de agenda_eventos em concreto. Repetições com fim definido
-- ("até data"/"N vezes") continuam a não passar por aqui — são geradas
-- todas de uma vez, como já acontecia.
create table public.agenda_series (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  cliente_id uuid references public.clientes(id) on delete set null,
  pt_id uuid references public.perfis(id) on delete set null,
  tipo tipo_evento_agenda not null default 'Treino',
  titulo text,
  hora_inicio time not null,
  duracao_min smallint not null default 40,
  repeticao text not null check (repeticao in ('semanal', 'quinzenal')),
  nota text,
  ativa boolean not null default true,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

create index agenda_series_estudio_id_ativa_idx on public.agenda_series (estudio_id, ativa);

alter table public.agenda_series enable row level security;
create policy "gerir_agenda_series" on public.agenda_series for all
  using (tenho_estudio(estudio_id)) with check (tenho_estudio(estudio_id));

-- Confirmado: 0 linhas com serie_id hoje, por isso esta FK não quebra
-- nada já existente.
alter table public.agenda_eventos
  add constraint agenda_eventos_serie_id_fkey
  foreign key (serie_id) references public.agenda_series(id) on delete set null;

create index if not exists agenda_eventos_serie_id_idx on public.agenda_eventos (serie_id) where serie_id is not null;
