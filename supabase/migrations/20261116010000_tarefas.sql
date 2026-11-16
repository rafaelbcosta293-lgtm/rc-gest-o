-- Tarefas da equipa (o que antes vivia no Asana).
--
-- Uma lista só para a empresa toda: qualquer conta com ficha (incluindo
-- as contas partilhadas RC Fátima / RC Leiria, onde a equipa a consulta)
-- vê e mexe em todas as tarefas. A exceção são as "reservadas" — de
-- gestão (salários, avaliações de desempenho…) — que só a administração
-- vê.
create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  -- Lista/projeto a que pertence (texto livre, com sugestões no ecrã).
  lista text,
  -- null = da empresa toda (não é de um estúdio em particular).
  estudio_id smallint references public.estudios(id),
  responsavel_id uuid references public.perfis(id) on delete set null,
  -- Sem prazo = "para ir fazendo".
  prazo date,
  estado text not null default 'por_fazer' check (estado in ('por_fazer', 'em_curso', 'feito')),
  -- Segunda-feira da semana em que a tarefa está no "foco da semana".
  foco_semana date,
  reservada boolean not null default false,
  concluida_em timestamptz,
  concluida_por uuid references public.perfis(id) on delete set null,
  -- De onde veio (ex.: 'asana') e o identificador lá, para uma
  -- importação repetida não duplicar tarefas.
  origem text,
  origem_id text,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (origem, origem_id)
);

create index tarefas_estado_prazo_idx on public.tarefas (estado, prazo);
create index tarefas_responsavel_idx on public.tarefas (responsavel_id);
create index tarefas_estudio_idx on public.tarefas (estudio_id);
create index tarefas_concluida_por_idx on public.tarefas (concluida_por);
create index tarefas_criado_por_idx on public.tarefas (criado_por);

alter table public.tarefas enable row level security;

-- Toda a equipa vê e edita; as reservadas só a administração.
create policy ver_tarefas on public.tarefas for select to authenticated
  using (
    exists (select 1 from public.perfis p where p.id = (select auth.uid()))
    and (not reservada or (select public.e_admin()))
  );
create policy criar_tarefas on public.tarefas for insert to authenticated
  with check (
    exists (select 1 from public.perfis p where p.id = (select auth.uid()))
    and (not reservada or (select public.e_admin()))
  );
create policy editar_tarefas on public.tarefas for update to authenticated
  using (
    exists (select 1 from public.perfis p where p.id = (select auth.uid()))
    and (not reservada or (select public.e_admin()))
  )
  with check (
    exists (select 1 from public.perfis p where p.id = (select auth.uid()))
    and (not reservada or (select public.e_admin()))
  );
-- Apagar de vez fica para a gestão; o resto da equipa conclui.
create policy apagar_tarefas on public.tarefas for delete to authenticated
  using ((select public.e_gestao()));

create or replace function public.tarefas_tocar_atualizado()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger trg_tarefas_tocar_atualizado before update on public.tarefas
  for each row execute function public.tarefas_tocar_atualizado();
