-- A lead pode pedir para ser contactada a uma hora certa (ex.: "liga-me
-- às 15h") — guardada à parte de "próximo_contacto" (só tem data, usado
-- pelo motor de alertas diário em lib/data/alertas.ts) para poder
-- acionar um alerta em tempo real, visível em toda a app, perto dessa
-- hora exata, em vez de só uma vez por dia via cron.
alter table public.leads add column proximo_contacto_hora time;
