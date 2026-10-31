drop policy "gerir_estado_sms_gateway" on public.estado_sms_gateway;
drop policy "ler_estado_sms_gateway" on public.estado_sms_gateway;
drop table public.estado_sms_gateway;

-- Cada estúdio tem o seu próprio telemóvel/gateway (ver
-- lib/sms/gateway.ts) — por isso uma linha de estado por estúdio, não
-- uma só global.
create table public.estado_sms_gateway (
  estudio_id smallint primary key references public.estudios(id),
  tentativas_falhadas smallint not null default 0,
  ultima_falha_em timestamptz,
  offline_desde timestamptz,
  alerta_registado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
insert into public.estado_sms_gateway (estudio_id)
  select id from public.estudios;

alter table public.estado_sms_gateway enable row level security;
create policy "ler_estado_sms_gateway" on public.estado_sms_gateway for select using (true);
create policy "gerir_estado_sms_gateway" on public.estado_sms_gateway for all using (e_gestao()) with check (e_gestao());
grant select, insert, update, delete on public.estado_sms_gateway to authenticated;
