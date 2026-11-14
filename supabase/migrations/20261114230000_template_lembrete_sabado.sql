-- Modelo próprio para o lembrete enviado ao sábado (referente à
-- segunda-feira). Começa igual ao modelo diário, com "amanhã" trocado
-- por "na próxima"; a partir daqui edita-se à parte na Administração.
insert into public.config (chave, valor)
select 'msg_lembrete_treino_sabado',
       regexp_replace(valor, 'amanhã(\s*,\s*\{dia_semana\}|\s+\{dia_semana\})?', 'na próxima {dia_semana}', 'i')
from public.config
where chave = 'msg_lembrete_treino'
on conflict (chave) do nothing;
