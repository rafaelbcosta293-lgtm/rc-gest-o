-- Aviso do Supabase: a partir de 30 de outubro de 2026, tabelas novas
-- deixam de receber automaticamente os grants que a Data API precisa
-- (supabase-js, PostgREST) — sem eles, a API dá "permission denied"
-- mesmo com RLS bem configurada. As únicas tabelas que este projeto
-- criou por migração (tarefas_diarias, tarefas_diarias_concluidas, em
-- 0004) já correram antes dessa mudança, por isso já devem ter os
-- grants automáticos de então — isto só confirma/repõe, em segurança
-- (grant é idempotente, correr outra vez não faz mal nenhum).

grant select on public.tarefas_diarias to anon;
grant select, insert, update, delete on public.tarefas_diarias to authenticated;
grant select, insert, update, delete on public.tarefas_diarias to service_role;

grant select on public.tarefas_diarias_concluidas to anon;
grant select, insert, update, delete on public.tarefas_diarias_concluidas to authenticated;
grant select, insert, update, delete on public.tarefas_diarias_concluidas to service_role;
