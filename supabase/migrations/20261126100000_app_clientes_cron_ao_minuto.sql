-- A sincronização com a app do cliente passa de 20 em 20 segundos para
-- minuto a minuto. Cada volta é uma chamada ao servidor da gestão (Vercel)
-- e, de 20 em 20 segundos, eram 4 320 por dia: ajudou a esgotar o
-- processamento incluído na conta (a Vercel pôs as duas apps em pausa a
-- 26/11/2026). O que o cliente pede na app (inscrever-se ou desmarcar)
-- passa a ser tratado, no pior caso, um minuto depois em vez de 20 s.
-- Continua a não correr nada enquanto não houver contas na app.
select cron.alter_job((select jobid from cron.job where jobname = 'app-clientes-sync'), schedule := '* * * * *');
