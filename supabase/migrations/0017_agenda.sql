-- Agenda interna: substitui a dependência do Google Calendar para
-- marcar treinos, avaliações e reuniões. Totalmente aditiva — não
-- mexe em nenhuma tabela existente, nem na integração com o Google
-- Calendar já usada na retenção/presença automática.

create type tipo_evento_agenda as enum ('Treino', 'Avaliação', 'Reunião', 'Outro');
create type estado_evento_agenda as enum ('Agendado', 'Cancelado', 'Concluído');

create table public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  cliente_id uuid references public.clientes(id) on delete set null,
  pt_id uuid references public.perfis(id) on delete set null,
  tipo tipo_evento_agenda not null default 'Treino',
  -- Só usado em eventos sem cliente (Reunião/Outro) — os ligados a um
  -- cliente mostram sempre o nome do cliente, não precisam de título.
  titulo text,
  data date not null,
  hora_inicio time not null,
  duracao_min smallint not null default 40,
  estado estado_evento_agenda not null default 'Agendado',
  -- Liga as ocorrências de um evento repetido (uma linha por
  -- ocorrência, não uma regra calculada) — desmarcar ou editar uma
  -- nunca afeta as outras.
  serie_id uuid,
  nota text,
  motivo_cancelamento text,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

create index agenda_eventos_estudio_data_idx on public.agenda_eventos (estudio_id, data);
create index agenda_eventos_pt_data_idx on public.agenda_eventos (pt_id, data);
create index agenda_eventos_cliente_idx on public.agenda_eventos (cliente_id);
create index agenda_eventos_serie_idx on public.agenda_eventos (serie_id);

alter table public.agenda_eventos enable row level security;

-- Mesmo padrão de gerir_presencas/gerir_avaliacoes: quem tem acesso ao
-- estúdio (staff) gere tudo; sem policy nenhuma para "authenticated"
-- em geral, por isso uma conta sem perfis_estudios não vê nada aqui.
create policy "gerir_agenda" on public.agenda_eventos
  for all
  using (tenho_estudio(estudio_id))
  with check (tenho_estudio(estudio_id));

grant select, insert, update, delete on public.agenda_eventos to authenticated;
