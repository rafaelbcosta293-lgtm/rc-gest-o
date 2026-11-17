-- Dias em que um estúdio está fechado (normalmente feriados): nesses
-- dias a Agenda não deixa marcar, mover nem repetir treinos para lá.
-- Toda a equipa do estúdio vê; só a gestão fecha e reabre.
create table public.dias_fechados (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  data date not null,
  motivo text,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (estudio_id, data)
);
create index dias_fechados_criado_por_idx on public.dias_fechados (criado_por);

alter table public.dias_fechados enable row level security;
create policy ver_dias_fechados on public.dias_fechados for select to authenticated
  using ((select public.tenho_estudio(estudio_id)));
create policy fechar_dias on public.dias_fechados for insert to authenticated
  with check ((select public.e_gestao()) and (select public.tenho_estudio(estudio_id)));
create policy reabrir_dias on public.dias_fechados for delete to authenticated
  using ((select public.e_gestao()) and (select public.tenho_estudio(estudio_id)));
