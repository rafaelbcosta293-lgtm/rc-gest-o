alter table public.agenda_eventos
  add column lembrete_enviado boolean not null default false,
  add column lembrete_enviado_em timestamptz;

create index agenda_eventos_lembrete_pendente_idx
  on public.agenda_eventos (data)
  where tipo = 'Treino' and estado = 'Agendado' and lembrete_enviado = false;

-- Estado do SMS Gateway (linha única) — regista falhas de ligação
-- consecutivas ao telemóvel e se já foi disparado o alerta por email
-- para esta "crise" (evita reenviar o email em cada tentativa; é
-- reposto a zero na próxima vez que um SMS é enviado com sucesso).
create table public.estado_sms_gateway (
  id smallint primary key default 1,
  tentativas_falhadas smallint not null default 0,
  ultima_falha_em timestamptz,
  alerta_enviado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint estado_sms_gateway_singleton check (id = 1)
);
insert into public.estado_sms_gateway (id) values (1);

alter table public.estado_sms_gateway enable row level security;
create policy "gerir_estado_sms_gateway" on public.estado_sms_gateway
  for all using (e_gestao()) with check (e_gestao());
grant select, insert, update, delete on public.estado_sms_gateway to authenticated;

-- Modelo da mensagem de lembrete de treino, guardado na tabela
-- "config" já existente (mesmo padrão de msg_aniversario) — só insere
-- se ainda não existir, para nunca pisar um valor já editado.
insert into public.config (chave, valor) values
  ('msg_lembrete_treino', 'Olá {nome}! Lembramos que o teu treino é {dia_semana}, dia {dia_mes}, às {hora}. Contamos contigo! Com os melhores cumprimentos, Equipa RC Private Fitness Studio')
on conflict (chave) do nothing;
