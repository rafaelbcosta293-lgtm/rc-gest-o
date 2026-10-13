-- Marcação automática de presença a partir da cor do evento no Google
-- Calendar: um evento na cor predefinida do calendário (sem override)
-- conta como presença ao terminar; se a cor for alterada depois
-- (staff sinaliza falta/cancelamento mudando a cor), a presença
-- automática é desfeita. Ver app/api/cron/presencas-calendario/route.ts.
--
-- "origem" distingue presenças criadas por este job ("calendario") das
-- marcadas à mão na app ("manual") — só mexemos numa linha "calendario"
-- quando o evento de origem (google_event_id) muda de cor; uma linha
-- "manual" nunca é tocada pelo job, mesmo que exista um evento com o
-- mesmo cliente/dia.
alter table public.presencas
  add column if not exists origem text not null default 'manual',
  add column if not exists google_event_id text;

alter table public.presencas
  drop constraint if exists presencas_origem_check;
alter table public.presencas
  add constraint presencas_origem_check check (origem in ('manual', 'calendario'));

-- Evita processar o mesmo evento duas vezes como se fosse presenças
-- diferentes; null (presenças manuais) fica de fora do índice.
create unique index if not exists presencas_google_event_id_key
  on public.presencas (google_event_id)
  where google_event_id is not null;
