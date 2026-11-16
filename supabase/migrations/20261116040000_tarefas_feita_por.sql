-- Tarefas: quem fez. Ao concluir uma tarefa indica-se sempre a pessoa
-- que a executou (as contas dos estúdios são partilhadas, por isso a
-- conta não diz quem foi) — é daqui que sai o resumo de quem faz o quê.
alter table public.tarefas
  add column if not exists feita_por uuid references public.perfis(id) on delete set null;
create index if not exists tarefas_feita_por_idx on public.tarefas (feita_por);
