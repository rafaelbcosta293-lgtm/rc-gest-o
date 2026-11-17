-- Serviços do estúdio (Treino Personalizado, Treino Acompanhado, Pilates,
-- Nutrição). Cada registo que conta para as métricas passa a dizer a que
-- serviço pertence, para se poder analisar cada serviço em separado e o
-- estúdio em conjunto. Tudo o que já existia fica como Treino
-- Personalizado (id 1) — as métricas atuais não mudam.

create table public.servicos (
  id smallint primary key,
  chave text not null unique,
  nome text not null unique,
  -- 'individual' (sessões marcadas por cliente) ou 'grupo' (aulas com lotação)
  formato text not null check (formato in ('individual', 'grupo')),
  ordem smallint not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.servicos (id, chave, nome, formato, ordem) values
  (1, 'pt', 'Treino Personalizado', 'individual', 1),
  (2, 'acompanhado', 'Treino Acompanhado', 'grupo', 2),
  (3, 'pilates', 'Pilates', 'grupo', 3),
  (4, 'nutricao', 'Nutrição', 'individual', 4);

alter table public.servicos enable row level security;
create policy ver_servicos on public.servicos for select to authenticated using (true);
create policy escrever_servicos on public.servicos for insert to authenticated with check (e_admin());
create policy editar_servicos on public.servicos for update to authenticated using (e_admin()) with check (e_admin());

-- Planos: cada plano é de um serviço.
alter table public.planos add column servico_id smallint not null default 1 references public.servicos(id);
update public.planos set servico_id = 4 where nome ilike 'nutri%';

-- Pagamentos: o serviço vem do plano (quando há plano); os antigos, sem
-- plano, ficam como Treino Personalizado.
alter table public.pagamentos add column servico_id smallint not null default 1 references public.servicos(id);
update public.pagamentos p set servico_id = pl.servico_id
  from public.planos pl where pl.id = p.plano_id and p.servico_id <> pl.servico_id;
create index pagamentos_servico_id_idx on public.pagamentos (servico_id);

create or replace function public.pagamento_servico_do_plano()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.plano_id is not null then
    select servico_id into new.servico_id from public.planos where id = new.plano_id;
  end if;
  return new;
end $$;
create trigger trg_pagamento_servico before insert or update of plano_id on public.pagamentos
  for each row execute function public.pagamento_servico_do_plano();

-- Agenda: cada marcação é de um serviço (as séries também, para o cron
-- as continuar no serviço certo).
alter table public.agenda_eventos add column servico_id smallint not null default 1 references public.servicos(id);
alter table public.agenda_series add column servico_id smallint not null default 1 references public.servicos(id);
create index agenda_eventos_servico_id_idx on public.agenda_eventos (servico_id);

-- Leads: o serviço de interesse (segue a "modalidade de interesse").
alter table public.leads add column servico_id smallint references public.servicos(id);
update public.leads l set servico_id = s.id from public.servicos s where s.nome = l.modalidade_interesse;

create or replace function public.lead_servico_da_modalidade()
returns trigger language plpgsql set search_path = public as $$
begin
  new.servico_id := (select id from public.servicos where nome = new.modalidade_interesse);
  return new;
end $$;
create trigger trg_lead_servico before insert or update of modalidade_interesse on public.leads
  for each row execute function public.lead_servico_da_modalidade();

-- Despesas e outras receitas: sem serviço = do estúdio (partilhada).
alter table public.despesas add column servico_id smallint references public.servicos(id);
alter table public.despesas_recorrentes add column servico_id smallint references public.servicos(id);
alter table public.receitas_outras add column servico_id smallint references public.servicos(id);
