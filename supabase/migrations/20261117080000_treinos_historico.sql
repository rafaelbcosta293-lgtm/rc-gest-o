-- Histórico de treinos dados por dia e por estúdio, de antes de a Agenda
-- ser usada (contagens enviadas à mão). A partir do momento em que a
-- Agenda passa a ser usada num estúdio, os treinos contam-se pela Agenda —
-- nunca os dois para o mesmo dia.
create table public.treinos_historico (
  estudio_id smallint not null references public.estudios(id),
  data date not null,
  treinos integer not null check (treinos >= 0),
  origem text not null default 'contagem manual',
  criado_em timestamptz not null default now(),
  primary key (estudio_id, data)
);
alter table public.treinos_historico enable row level security;
create policy ver_treinos_historico on public.treinos_historico for select to authenticated using (public.tenho_estudio(estudio_id));
create policy gerir_treinos_historico on public.treinos_historico for all to authenticated using (public.e_admin()) with check (public.e_admin());
