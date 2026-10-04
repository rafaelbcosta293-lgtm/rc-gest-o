-- "Tarefas diárias" foi removida da app. As tabelas já foram apagadas
-- diretamente no Supabase — isto fica só para o histórico de
-- migrações refletir com exatidão o estado real da base de dados
-- (drop idempotente, não faz mal correr outra vez).
drop table if exists public.tarefas_diarias_concluidas;
drop table if exists public.tarefas_diarias;
