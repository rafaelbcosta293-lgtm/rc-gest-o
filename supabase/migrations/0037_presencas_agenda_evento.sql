-- Liga uma presença ao evento da agenda que a criou — mesmo padrão já
-- usado para o calendário (google_event_id) — para se poder desfazer
-- SÓ a presença que um evento da agenda criou (nunca uma marcada à
-- mão) quando esse evento for desmarcado depois, mesmo que seja no dia
-- seguinte.
alter table public.presencas
  add column agenda_evento_id uuid references public.agenda_eventos(id) on delete set null;

create index presencas_agenda_evento_idx on public.presencas (agenda_evento_id);
