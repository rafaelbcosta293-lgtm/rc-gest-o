-- Guardar a mensagem de erro de cada falha do telemóvel dos SMS, para se
-- saber a causa (os registos da Vercel só duram 1 hora).
alter table public.estado_sms_gateway add column ultimo_erro text;

create table public.sms_gateway_falhas (
  id bigint generated always as identity primary key,
  estudio_id smallint not null references public.estudios(id),
  ocorrido_em timestamptz not null default now(),
  -- 'lembretes' ou 'aniversarios'
  origem text not null,
  mensagem text not null
);
create index sms_gateway_falhas_estudio_idx on public.sms_gateway_falhas (estudio_id, ocorrido_em desc);
alter table public.sms_gateway_falhas enable row level security;
create policy ver_sms_gateway_falhas on public.sms_gateway_falhas for select to authenticated
  using (public.e_gestao() and public.tenho_estudio(estudio_id));
