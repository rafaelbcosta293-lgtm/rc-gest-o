-- Base para a área de clientes (login próprio, separado do login da
-- equipa). Tudo aqui é aditivo: não altera nenhuma policy existente,
-- só acrescenta uma coluna nova, uma tabela nova e policies novas que
-- só se aplicam a quem tiver essa coluna preenchida (ninguém hoje).

alter table public.clientes
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- Eventos/avisos publicados pela equipa para os clientes lerem na app
-- deles. estudio_id nulo = evento para os dois estúdios.
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint references public.estudios(id),
  titulo text not null,
  corpo text not null,
  publicado boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.eventos enable row level security;

create policy "equipa gere eventos do seu estudio" on public.eventos
  for all using (
    e_gestao() and (estudio_id is null or tenho_estudio(estudio_id))
  ) with check (
    e_gestao() and (estudio_id is null or tenho_estudio(estudio_id))
  );

create policy "cliente ve eventos publicados do seu estudio" on public.eventos
  for select using (
    publicado = true
    and (
      estudio_id is null
      or exists (
        select 1 from public.clientes c
        where c.auth_user_id = auth.uid() and c.estudio_id = eventos.estudio_id
      )
    )
  );

grant select on public.eventos to authenticated;
grant insert, update, delete on public.eventos to authenticated;

-- Policies aditivas: um cliente só vê a própria ficha e os seus
-- próprios dados. Não substituem nem restringem o acesso da equipa
-- (continua a ser o mesmo, via tenho_estudio/e_admin) — Postgres
-- combina várias policies "permissive" com OR.
create policy "cliente ve a propria ficha" on public.clientes
  for select using (auth_user_id = auth.uid());

create policy "cliente ve as proprias avaliacoes" on public.avaliacoes
  for select using (
    exists (
      select 1 from public.clientes c
      where c.id = avaliacoes.cliente_id and c.auth_user_id = auth.uid()
    )
  );

create policy "cliente ve as proprias presencas" on public.presencas
  for select using (
    exists (
      select 1 from public.clientes c
      where c.id = presencas.cliente_id and c.auth_user_id = auth.uid()
    )
  );
