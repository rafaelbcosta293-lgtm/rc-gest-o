alter table public.estado_sms_gateway
  add column offline_desde timestamptz;

alter table public.estado_sms_gateway
  rename column alerta_enviado_em to alerta_registado_em;

-- Qualquer pessoa com sessão pode LER o estado (a faixa vermelha é
-- para todos quem usa a app) — só gerir (escrever) continua restrito a
-- e_gestao() pela policy "gerir_estado_sms_gateway" já existente.
create policy "ler_estado_sms_gateway" on public.estado_sms_gateway
  for select using (true);

-- Necessário como FK antes de "alerts" poder referenciar esta chave.
insert into public.alert_rules (chave, nome, descricao, severidade_base, ativo) values
  ('sms_gateway_offline', 'SMS Gateway offline', 'O telemóvel que envia os lembretes de treino por SMS está inacessível.', 'Crítico', true)
on conflict (chave) do nothing;
