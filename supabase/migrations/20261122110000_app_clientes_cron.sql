-- Sincronização com a app do cliente: de 20 em 20 segundos o pg_cron
-- chama a rota /api/cron/app-clientes do servidor da gestão — mas só
-- quando há contas na app (até ao primeiro convite não corre nada).
-- O endereço e o segredo ficam no Vault (inseridos à parte, não aqui):
--   app_clientes_url_sync     → https://<gestão>/api/cron/app-clientes
--   app_clientes_cron_secret  → igual a APP_CLIENTES_CRON_SECRET no Vercel
select cron.unschedule(jobid) from cron.job where jobname = 'app-clientes-sync';
select cron.schedule('app-clientes-sync', '20 seconds', $cron$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_clientes_url_sync'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'app_clientes_cron_secret')),
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.app_clientes_contas where ativa)
     or exists (select 1 from public.app_clientes_contas_a_remover);
$cron$);
