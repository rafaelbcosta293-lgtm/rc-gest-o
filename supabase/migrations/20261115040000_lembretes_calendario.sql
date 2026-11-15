-- Calendário da Administração: lembretes de tarefas e pagamentos, únicos
-- ou que se repetem. As despesas não se copiam para aqui — o calendário
-- lê-as diretamente das tabelas de despesas.
create table public.lembretes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'tarefa' check (tipo in ('tarefa', 'pagamento', 'outro')),
  -- Primeira data (ou a única, quando não se repete).
  data date not null,
  periodicidade text not null default 'unica'
    check (periodicidade in ('unica', 'semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  -- Último dia em que ainda se repete (vazio = sem fim).
  fim date,
  valor numeric(10, 2),
  notas text,
  estudio_id smallint references public.estudios(id) on delete set null,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Cada ocorrência tratada (um lembrete mensal tem uma por mês).
create table public.lembretes_feitos (
  lembrete_id uuid not null references public.lembretes(id) on delete cascade,
  data date not null,
  feito_em timestamptz not null default now(),
  feito_por uuid references public.perfis(id) on delete set null,
  primary key (lembrete_id, data)
);

create index lembretes_estudio_idx on public.lembretes (estudio_id);
create index lembretes_criado_por_idx on public.lembretes (criado_por);
create index lembretes_feitos_feito_por_idx on public.lembretes_feitos (feito_por);

alter table public.lembretes enable row level security;
alter table public.lembretes_feitos enable row level security;

-- Só a Administração.
create policy admin_lembretes on public.lembretes for all
  using ((select e_admin())) with check ((select e_admin()));
create policy admin_lembretes_feitos on public.lembretes_feitos for all
  using ((select e_admin())) with check ((select e_admin()));
