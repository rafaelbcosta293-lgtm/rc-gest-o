-- Registo de auditoria (secção 7): "quem alterou o quê e quando,
-- sobretudo em pagamentos e preços". Guarda a linha completa antes/
-- depois em jsonb — inclui valores em €, por isso é admin-only, igual
-- a "pagamentos"/"planos".
create type acao_auditoria as enum ('INSERT', 'UPDATE', 'DELETE');

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registo_id text not null,
  acao acao_auditoria not null,
  dados_antigos jsonb,
  dados_novos jsonb,
  alterado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);
create index auditoria_tabela_idx on public.auditoria (tabela, criado_em desc);
alter table public.auditoria enable row level security;
create policy "admin_auditoria" on public.auditoria for select using (e_admin());
grant select on public.auditoria to authenticated;

create or replace function public.registar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into auditoria (tabela, registo_id, acao, dados_antigos, dados_novos, alterado_por)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, ''),
    tg_op::acao_auditoria,
    case when tg_op in ('UPDATE', 'DELETE') then row_to_json(old)::jsonb else null end,
    case when tg_op in ('INSERT', 'UPDATE') then row_to_json(new)::jsonb else null end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_auditoria_pagamentos
after insert or update or delete on public.pagamentos
for each row execute function public.registar_auditoria();

create trigger trg_auditoria_planos
after insert or update or delete on public.planos
for each row execute function public.registar_auditoria();

-- "config" guarda preços e outros valores de negócio (ver
-- 0024_config_settings_crm.sql) — a chave primária é "chave" (text),
-- não "id", por isso o trigger genérico acima (que lê .id) não serve;
-- fica com o seu próprio, mais simples (config só sofre update, nunca
-- insert/delete pela app).
create or replace function public.registar_auditoria_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into auditoria (tabela, registo_id, acao, dados_antigos, dados_novos, alterado_por)
  values ('config', new.chave, 'UPDATE', row_to_json(old)::jsonb, row_to_json(new)::jsonb, auth.uid());
  return new;
end;
$$;

create trigger trg_auditoria_config
after update on public.config
for each row execute function public.registar_auditoria_config();
