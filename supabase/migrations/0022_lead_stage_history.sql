-- Histórico de etapas do funil: uma linha por mudança, gravada
-- automaticamente por trigger (nunca escrita diretamente pela app) —
-- é a base das taxas de conversão e dos tempos por etapa.
create table public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  estado_anterior estado_lead,
  estado_novo estado_lead not null,
  mudado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

create index lead_stage_history_lead_idx on public.lead_stage_history (lead_id, criado_em);

alter table public.lead_stage_history enable row level security;

create policy "ver_historico_etapas" on public.lead_stage_history
  for select
  using (exists (select 1 from leads l where l.id = lead_stage_history.lead_id and tenho_estudio(l.estudio_id)));

grant select on public.lead_stage_history to authenticated;

create or replace function public.registar_mudanca_etapa_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into lead_stage_history (lead_id, estado_anterior, estado_novo, mudado_por)
    values (new.id, null, new.estado, auth.uid());
  elsif (tg_op = 'UPDATE' and new.estado is distinct from old.estado) then
    insert into lead_stage_history (lead_id, estado_anterior, estado_novo, mudado_por)
    values (new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_lead_stage_history
after insert or update on public.leads
for each row execute function public.registar_mudanca_etapa_lead();
