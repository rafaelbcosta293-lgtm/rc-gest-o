-- Tarefas: os campos que faltavam para fazer o mesmo que o Asana —
-- hora, data de início, prioridade, etiquetas, subtarefas, comentários e
-- repetição personalizada (de N em N semanas/meses, anual, N dias depois
-- de concluir, até uma data). Só acrescenta: não apaga nem altera nada
-- do que já existe.
alter table public.tarefas
  -- Hora do prazo (opcional) e data de início (para tarefas que duram
  -- vários dias: aparecem no calendário do início ao prazo).
  add column if not exists hora time,
  add column if not exists inicio date,
  add column if not exists prioridade text check (prioridade in ('baixa', 'media', 'alta')),
  add column if not exists etiquetas text[] not null default '{}',
  -- Subtarefa de outra tarefa.
  add column if not exists tarefa_mae_id uuid references public.tarefas(id) on delete cascade,
  -- Repetição: de quantas em quantas semanas/meses/anos (1 = todas).
  add column if not exists repete_intervalo smallint not null default 1 check (repete_intervalo between 1 and 52),
  add column if not exists repete_anual boolean not null default false,
  -- Mensal pelo dia da semana (ex.: 1.ª segunda-feira) em vez do dia do mês.
  add column if not exists repete_mensal_dia_semana boolean not null default false,
  -- "Periodicamente": volta a aparecer N dias depois de ser concluída.
  add column if not exists repete_apos_dias smallint check (repete_apos_dias between 1 and 365),
  -- A repetição acaba nesta data.
  add column if not exists repete_ate date;

alter table public.tarefas
  add constraint tarefas_inicio_antes_do_prazo check (inicio is null or prazo is null or inicio <= prazo);

-- Só uma forma de repetir de cada vez, e qualquer repetição exige prazo.
-- (Junta-se à regra que já existia para as duas formas iniciais.)
alter table public.tarefas
  add constraint tarefas_repeticao_uma_forma check (
    ((repete_dias is not null)::int + repete_mensal::int + repete_anual::int + (repete_apos_dias is not null)::int) <= 1
    and (
      (repete_dias is null and not repete_mensal and not repete_anual and repete_apos_dias is null)
      or prazo is not null
    )
  );

create index if not exists tarefas_mae_idx on public.tarefas (tarefa_mae_id);

-- Comentários de uma tarefa.
create table public.tarefas_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null default auth.uid(),
  -- Quem escreveu, quando a conta é partilhada (tablet do estúdio).
  autor_nome text,
  texto text not null check (length(trim(texto)) > 0),
  criado_em timestamptz not null default now()
);
create index tarefas_comentarios_tarefa_idx on public.tarefas_comentarios (tarefa_id, criado_em);
create index tarefas_comentarios_autor_idx on public.tarefas_comentarios (autor_id);

alter table public.tarefas_comentarios enable row level security;

-- Vê (e escreve) comentários quem vê a tarefa — a consulta à tabela de
-- tarefas já esconde as reservadas a quem não é da administração.
create policy ver_tarefas_comentarios on public.tarefas_comentarios for select to authenticated
  using (exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy criar_tarefas_comentarios on public.tarefas_comentarios for insert to authenticated
  with check (exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy apagar_tarefas_comentarios on public.tarefas_comentarios for delete to authenticated
  using (autor_id = (select auth.uid()) or (select public.e_gestao()));
