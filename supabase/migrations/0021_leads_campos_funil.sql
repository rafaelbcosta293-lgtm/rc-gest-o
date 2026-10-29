-- Campos novos em "leads" pedidos pela especificação do CRM — todos
-- opcionais, para não quebrar leads já existentes.
create type temperatura_lead as enum ('Fria', 'Morna', 'Quente');

alter table public.leads
  add column campanha text,
  add column modalidade_interesse text,
  add column temperatura temperatura_lead not null default 'Morna';

comment on column public.leads.campanha is 'Campanha de marketing de origem (opcional) — texto livre, ligado a marketing_costs pelo nome.';
comment on column public.leads.modalidade_interesse is 'Treino Personalizado / Treino Acompanhado / outro — texto livre, como "interesse" e "objetivo" já existentes nesta tabela.';
