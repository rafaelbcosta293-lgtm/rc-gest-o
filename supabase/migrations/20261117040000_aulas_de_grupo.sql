-- Fase 3 dos serviços: aulas de grupo (Treino Acompanhado, Pilates).
--
-- * aulas_horario: o horário semanal (modelo) — ex.: Pilates, terça,
--   19:00, 50 min, instrutora X, lotação 5. A app gera as aulas das
--   semanas seguintes a partir dele (saltando os dias fechados).
-- * aulas: cada aula concreta, aberta a inscrições, com lotação.
-- * aulas_inscricoes: inscrição aula a aula (semana a semana). A lotação
--   é garantida na base de dados (função inscrever_em_aula), para que no
--   futuro a app dos clientes use exatamente a mesma regra.

alter table public.servicos add column lotacao_omissao smallint;
update public.servicos set lotacao_omissao = 8 where chave = 'acompanhado';
update public.servicos set lotacao_omissao = 5 where chave = 'pilates';

create table public.aulas_horario (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  servico_id smallint not null references public.servicos(id),
  -- 1 = segunda … 7 = domingo
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora_inicio time not null,
  duracao_min smallint not null default 50 check (duracao_min between 10 and 240),
  instrutor_id uuid references public.perfis(id) on delete set null,
  lotacao smallint not null check (lotacao between 1 and 50),
  ativo boolean not null default true,
  desde date not null default current_date,
  ate date,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null default auth.uid()
);

create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  servico_id smallint not null references public.servicos(id),
  horario_id uuid references public.aulas_horario(id) on delete set null,
  data date not null,
  hora_inicio time not null,
  duracao_min smallint not null default 50,
  instrutor_id uuid references public.perfis(id) on delete set null,
  lotacao smallint not null check (lotacao between 1 and 50),
  estado text not null default 'Aberta' check (estado in ('Aberta', 'Cancelada')),
  motivo_cancelamento text,
  nota text,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  unique (horario_id, data)
);
create index aulas_estudio_data_idx on public.aulas (estudio_id, data);

create table public.aulas_inscricoes (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references public.aulas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  -- Inscrito → (no dia) Presente / Faltou; Cancelada liberta a vaga.
  estado text not null default 'Inscrito' check (estado in ('Inscrito', 'Presente', 'Faltou', 'Cancelada')),
  origem text not null default 'equipa' check (origem in ('equipa', 'cliente')),
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  atualizado_em timestamptz not null default now(),
  unique (aula_id, cliente_id)
);
create index aulas_inscricoes_cliente_idx on public.aulas_inscricoes (cliente_id);

alter table public.aulas_horario enable row level security;
alter table public.aulas enable row level security;
alter table public.aulas_inscricoes enable row level security;

create policy ver_aulas_horario on public.aulas_horario for select to authenticated using (public.tenho_estudio(estudio_id));
create policy gerir_aulas_horario on public.aulas_horario for all to authenticated
  using (public.e_gestao() and public.tenho_estudio(estudio_id))
  with check (public.e_gestao() and public.tenho_estudio(estudio_id));

create policy ver_aulas on public.aulas for select to authenticated using (public.tenho_estudio(estudio_id));
create policy criar_aulas on public.aulas for insert to authenticated with check (public.tenho_estudio(estudio_id));
create policy editar_aulas on public.aulas for update to authenticated
  using (public.tenho_estudio(estudio_id)) with check (public.tenho_estudio(estudio_id));
create policy apagar_aulas on public.aulas for delete to authenticated using (public.e_gestao() and public.tenho_estudio(estudio_id));

create policy ver_inscricoes on public.aulas_inscricoes for select to authenticated
  using (exists (select 1 from public.aulas a where a.id = aula_id and public.tenho_estudio(a.estudio_id)));
create policy editar_inscricoes on public.aulas_inscricoes for update to authenticated
  using (exists (select 1 from public.aulas a where a.id = aula_id and public.tenho_estudio(a.estudio_id)))
  with check (exists (select 1 from public.aulas a where a.id = aula_id and public.tenho_estudio(a.estudio_id)));
-- Inscrever só pela função (que garante a lotação).

-- Inscreve um cliente numa aula, se houver vaga. Bloqueia a linha da
-- aula para dois pedidos ao mesmo tempo não ocuparem a mesma vaga.
-- Devolve o id da inscrição; erro legível se estiver cheia/cancelada.
create or replace function public.inscrever_em_aula(p_aula uuid, p_cliente uuid, p_origem text default 'equipa')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_aula public.aulas%rowtype;
  v_ocupadas int;
  v_id uuid;
begin
  select * into v_aula from public.aulas where id = p_aula for update;
  if not found then raise exception 'Aula não encontrada.'; end if;
  if not public.tenho_estudio(v_aula.estudio_id) then raise exception 'Sem acesso a esta aula.'; end if;
  if v_aula.estado <> 'Aberta' then raise exception 'Esta aula foi cancelada.'; end if;
  if not exists (select 1 from public.clientes c where c.id = p_cliente and c.estudio_id = v_aula.estudio_id) then
    raise exception 'Cliente não encontrado neste estúdio.';
  end if;

  select id into v_id from public.aulas_inscricoes
   where aula_id = p_aula and cliente_id = p_cliente and estado <> 'Cancelada';
  if v_id is not null then return v_id; end if;

  select count(*) into v_ocupadas from public.aulas_inscricoes where aula_id = p_aula and estado <> 'Cancelada';
  if v_ocupadas >= v_aula.lotacao then raise exception 'A aula está cheia (% de %).', v_ocupadas, v_aula.lotacao; end if;

  insert into public.aulas_inscricoes (aula_id, cliente_id, estado, origem)
  values (p_aula, p_cliente, 'Inscrito', coalesce(p_origem, 'equipa'))
  on conflict (aula_id, cliente_id) do update set estado = 'Inscrito', origem = excluded.origem, atualizado_em = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.inscrever_em_aula(uuid, uuid, text) from public, anon;
grant execute on function public.inscrever_em_aula(uuid, uuid, text) to authenticated;

-- A lotação de uma aula não pode descer abaixo de quem já lá está.
create or replace function public.aula_lotacao_valida()
returns trigger language plpgsql set search_path = public as $$
declare v_ocupadas int;
begin
  if new.lotacao < old.lotacao then
    select count(*) into v_ocupadas from public.aulas_inscricoes where aula_id = new.id and estado <> 'Cancelada';
    if v_ocupadas > new.lotacao then
      raise exception 'Já há % inscritos — a lotação não pode ficar em %.', v_ocupadas, new.lotacao;
    end if;
  end if;
  return new;
end $$;
create trigger trg_aula_lotacao before update of lotacao on public.aulas
  for each row execute function public.aula_lotacao_valida();
