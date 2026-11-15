-- v_estado_pagamento: verificar o acesso ao estúdio uma vez por consulta
-- em vez de uma vez por cliente.
--
-- A vista filtrava com tenho_estudio(c.estudio_id), que o Postgres corre
-- linha a linha (cada chamada vai ler o papel e os estúdios da conta).
-- Com (select ...) a resposta é calculada uma só vez e reutilizada —
-- a mesma técnica já aplicada às políticas RLS em
-- 20261115010000_desempenho_rls.sql. O resultado é exatamente o mesmo:
-- administradores veem tudo, os restantes só os seus estúdios (e a RLS
-- de "clientes" continua a aplicar-se, a vista é security_invoker).
create or replace view public.v_estado_pagamento
with (security_invoker = true) as
select
  c.id as cliente_id,
  c.estudio_id,
  c.nome,
  max(p.valido_ate) as valido_ate,
  coalesce(max(p.valido_ate) >= current_date, false) as em_dia
from public.clientes c
left join public.pagamentos p
  on p.cliente_id = c.id and p.anulado_em is null and p.mensalidade
where c.estado = 'Ativo'::public.estado_cliente
  and ((select public.e_admin()) or c.estudio_id = any ((select public.estudios_acessiveis())::smallint[]))
group by c.id, c.estudio_id, c.nome;
