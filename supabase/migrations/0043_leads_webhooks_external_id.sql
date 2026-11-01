-- Suporte a leads criadas automaticamente por webhook (Meta Ads, Google
-- Forms, Website): guarda o identificador da origem externa para os
-- webhooks poderem repetir o envio (reentregas da Meta, nova tentativa do
-- Apps Script) sem duplicar o registo, e um índice por telefone para a
-- mesma verificação de duplicados ser rápida.
alter table public.leads
  add column if not exists external_id text;

create unique index if not exists leads_external_id_idx
  on public.leads (external_id)
  where external_id is not null;

create index if not exists leads_estudio_id_telefone_idx
  on public.leads (estudio_id, telefone)
  where telefone is not null;

comment on column public.leads.external_id is 'Identificador da origem externa (ex.: "meta_<leadgen_id>", "google_<id>"), usado só para o webhook não duplicar a lead em reenvios — nunca mostrado na interface.';
