-- Lista de tarefas diárias do estúdio (toalhas a lavar, lixos, repor gel,
-- etc.) — mais simples que o checklist de Abertura/Fecho: a coordenação
-- gere livremente a lista (criar/remover tarefas a qualquer momento) e
-- qualquer pessoa da equipa marca o que já fez, todos os dias.

create table if not exists public.tarefas_diarias (
  id uuid primary key default gen_random_uuid(),
  estudio_id integer not null references public.estudios(id),
  titulo text not null,
  ativa boolean not null default true,
  ordem int not null default 0,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.tarefas_diarias_concluidas (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas_diarias(id) on delete cascade,
  data date not null,
  feito_por uuid references public.perfis(id),
  feito_em timestamptz not null default now(),
  unique (tarefa_id, data)
);

alter table public.tarefas_diarias enable row level security;
alter table public.tarefas_diarias_concluidas enable row level security;

-- Qualquer pessoa com acesso ao estúdio vê a lista de tarefas ativas.
create policy "ver tarefas do meu estudio" on public.tarefas_diarias
  for select using (tenho_estudio(estudio_id));

-- Só coordenação/gestão cria, edita ou desativa tarefas.
create policy "gestao cria tarefas" on public.tarefas_diarias
  for insert with check (tenho_estudio(estudio_id) and e_gestao());

create policy "gestao atualiza tarefas" on public.tarefas_diarias
  for update using (tenho_estudio(estudio_id) and e_gestao());

-- Ver, marcar e desmarcar "feito hoje" — qualquer pessoa com acesso ao
-- estúdio da tarefa correspondente.
create policy "ver tarefas concluidas do meu estudio" on public.tarefas_diarias_concluidas
  for select using (
    exists (
      select 1 from public.tarefas_diarias t
      where t.id = tarefa_id and tenho_estudio(t.estudio_id)
    )
  );

create policy "marcar tarefa como feita" on public.tarefas_diarias_concluidas
  for insert with check (
    exists (
      select 1 from public.tarefas_diarias t
      where t.id = tarefa_id and tenho_estudio(t.estudio_id)
    )
  );

create policy "desmarcar tarefa" on public.tarefas_diarias_concluidas
  for delete using (
    exists (
      select 1 from public.tarefas_diarias t
      where t.id = tarefa_id and tenho_estudio(t.estudio_id)
    )
  );
