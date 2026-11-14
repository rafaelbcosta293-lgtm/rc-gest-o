-- A equipa de cada estúdio passa a poder atualizar a checklist que
-- preenche (nº de itens feitos e notas de turno). Até aqui só a gestão
-- o podia fazer: nas contas partilhadas dos estúdios os vistos ficavam
-- gravados, mas o total e as ocorrências não.
drop policy if exists gerir_chk on public.checklist_registos;
create policy gerir_chk on public.checklist_registos for update
  using (tenho_estudio(estudio_id)) with check (tenho_estudio(estudio_id));

-- Acerta os totais que ficaram por gravar.
update public.checklist_registos r
set concluidos = c.feitos
from (
  select registo_id, count(*) filter (where ok) as feitos
  from public.checklist_respostas
  group by registo_id
) c
where c.registo_id = r.id and r.concluidos <> c.feitos;
