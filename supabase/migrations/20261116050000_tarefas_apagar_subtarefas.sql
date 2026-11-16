-- Subtarefas (os passos de uma tarefa) podem ser retiradas por qualquer
-- pessoa da equipa; apagar uma tarefa inteira continua a ser só da gestão.
create policy apagar_subtarefas on public.tarefas for delete to authenticated
  using (
    tarefa_mae_id is not null
    and exists (select 1 from public.perfis p where p.id = (select auth.uid()))
    and (not reservada or (select public.e_admin()))
  );
