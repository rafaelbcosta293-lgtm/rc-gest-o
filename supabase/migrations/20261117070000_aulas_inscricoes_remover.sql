-- Remover uma inscrição feita por engano (apaga-a, sem ficar como
-- "Cancelada" no histórico). Quem pode ver/editar as aulas do estúdio.
create policy apagar_inscricoes on public.aulas_inscricoes for delete to authenticated
  using (exists (select 1 from public.aulas a where a.id = aula_id and public.tenho_estudio(a.estudio_id)));
