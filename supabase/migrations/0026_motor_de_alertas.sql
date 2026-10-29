create type severidade_alerta as enum ('Info', 'Atenção', 'Crítico');
create type estado_alerta as enum ('Novo', 'Visto', 'Resolvido', 'Adiado');

-- Regras configuráveis (limites em "limites" jsonb) — a tabela da
-- secção 5 da especificação. Os valores concretos das regras iniciais
-- entram numa migração seguinte, depois de validar os limites.
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  nome text not null,
  descricao text,
  severidade_base severidade_alerta not null default 'Atenção',
  ativo boolean not null default true,
  limites jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
alter table public.alert_rules enable row level security;
create policy "ler_alert_rules" on public.alert_rules for select using (true);
create policy "gerir_alert_rules" on public.alert_rules for all using (e_gestao()) with check (e_gestao());
grant select, insert, update, delete on public.alert_rules to authenticated;

-- Alertas individuais, já associados a uma lead/cliente/estúdio e com
-- os estados pedidos (novo/visto/resolvido/adiado) e resolução
-- automática (a função que avalia as regras marca "Resolvido" quando a
-- condição deixa de se verificar — entra na Fase 4).
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  regra_chave text references public.alert_rules(chave),
  severidade severidade_alerta not null,
  titulo text not null,
  descricao text,
  lead_id uuid references public.leads(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  papel_destinatario papel_utilizador,
  perfil_destinatario uuid references public.perfis(id),
  estado estado_alerta not null default 'Novo',
  adiado_ate date,
  resolvido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index alerts_estudio_estado_idx on public.alerts (estudio_id, estado);
alter table public.alerts enable row level security;
create policy "gerir_alerts" on public.alerts for all using (tenho_estudio(estudio_id)) with check (tenho_estudio(estudio_id));
grant select, insert, update, delete on public.alerts to authenticated;
