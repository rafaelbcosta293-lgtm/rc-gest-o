-- Retenção de clientes: deteta quem está sem treinar há mais de 7 dias
-- e não tem sessão futura marcada no Google Calendar do estúdio.
--
-- A condição "sem presença há 7 dias" é calculada aqui, em SQL — é
-- barata e pode correr a cada carregamento da página. A condição "sem
-- evento no Google Calendar" não pode: exige uma chamada a uma API
-- externa, por isso é calculada uma vez por dia por um job
-- (app/api/cron/retencao) e o resultado fica em cache na tabela
-- "clientes_sem_agendamento" — a Coordenação só lê essa cache.

create or replace view public.v_clientes_sem_treino_recente
with (security_invoker = true) as
select
  c.id as cliente_id,
  c.estudio_id,
  c.nome,
  c.numero_socio,
  max(p.data) filter (where p.estado = 'Presente') as ultima_presenca,
  (
    current_date - coalesce(
      max(p.data) filter (where p.estado = 'Presente'),
      c.inicio_contrato,
      c.criado_em::date
    )
  ) as dias_sem_treino
from public.clientes c
left join public.presencas p on p.cliente_id = c.id
where c.estado = 'Ativo'
group by c.id;

grant select on public.v_clientes_sem_treino_recente to anon;
grant select on public.v_clientes_sem_treino_recente to authenticated;
grant select on public.v_clientes_sem_treino_recente to service_role;

create table if not exists public.clientes_sem_agendamento (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  verificado_em timestamptz not null default now()
);

alter table public.clientes_sem_agendamento enable row level security;

-- Só quem tem acesso ao estúdio do cliente vê esta entrada. Escrever
-- aqui é só o job diário (via service_role, que ignora RLS) — não há
-- policy de insert/update/delete para "authenticated" de propósito.
create policy "ver clientes sem agendamento do meu estudio" on public.clientes_sem_agendamento
  for select using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and tenho_estudio(c.estudio_id)
    )
  );

grant select on public.clientes_sem_agendamento to anon;
grant select on public.clientes_sem_agendamento to authenticated;
grant select, insert, update, delete on public.clientes_sem_agendamento to service_role;
