-- Aviso "o horário foi atualizado", um por pessoa, estúdio e semana.
-- Criado (ou reposto como "por ver") sempre que a coordenação guarda a
-- escala dessa semana; a pessoa fecha-o na sua conta.
create table public.avisos_horario (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  estudio_id smallint not null references public.estudios(id) on delete cascade,
  semana date not null,
  atualizado_em timestamptz not null default now(),
  visto_em timestamptz,
  primary key (perfil_id, estudio_id, semana)
);

create index avisos_horario_por_ver_idx on public.avisos_horario (perfil_id) where visto_em is null;
create index avisos_horario_estudio_idx on public.avisos_horario (estudio_id);

alter table public.avisos_horario enable row level security;

-- Cada pessoa vê e fecha os seus; a gestão (quem publica as escalas)
-- cria-os e volta a pô-los "por ver" quando a escala muda outra vez.
create policy ler_avisos_horario on public.avisos_horario for select
  using (perfil_id = (select auth.uid()) or (select e_gestao()));
create policy criar_avisos_horario on public.avisos_horario for insert
  with check ((select e_gestao()));
create policy editar_avisos_horario on public.avisos_horario for update
  using (perfil_id = (select auth.uid()) or (select e_gestao()))
  with check (perfil_id = (select auth.uid()) or (select e_gestao()));
create policy apagar_avisos_horario on public.avisos_horario for delete
  using ((select e_gestao()));
