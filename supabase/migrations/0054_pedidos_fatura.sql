-- Faturação via ZS Go (série API-20262, chave em ZSGO_API_KEY).
--
-- O instrutor nunca emite faturas: no registo do pagamento só "pede"
-- uma fatura. Fica um pedido pendente, já com um rascunho pré-preenchido
-- (cliente, NIF, linhas, método). Só a administração (e_admin) pode
-- editar esse rascunho, emiti-lo no ZS Go ou rejeitá-lo.

-- NIF e código do cliente no ZS Go (guardado depois da 1.ª fatura,
-- para não criar o mesmo cliente duas vezes no ZS Go).
alter table public.clientes add column if not exists nif text;
alter table public.clientes add column if not exists zsgo_cliente_codigo text;

create table public.pedidos_fatura (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estudio_id smallint not null references public.estudios(id),
  -- 'a_emitir' é um trinco: impede dois cliques seguidos de emitirem a
  -- mesma fatura duas vezes no ZS Go.
  estado text not null default 'pendente'
    check (estado in ('pendente', 'a_emitir', 'emitida', 'rejeitada', 'erro')),
  -- Rascunho editável da fatura: { cliente: {...}, documento: {...}, linhas: [...] }
  rascunho jsonb not null,
  nota_pedido text,
  pedido_por uuid references public.perfis(id),
  pedido_em timestamptz not null default now(),
  resolvido_por uuid references public.perfis(id),
  resolvido_em timestamptz,
  motivo_rejeicao text,
  ultimo_erro text,
  zsgo_documento_id text,
  zsgo_numero text,
  zsgo_pdf_url text,
  zsgo_resposta jsonb,
  atualizado_em timestamptz not null default now()
);

-- Um pagamento só pode ter um pedido "vivo" (pendente/erro/emitida);
-- depois de rejeitado pode voltar a ser pedido.
create unique index pedidos_fatura_um_por_pagamento
  on public.pedidos_fatura (pagamento_id)
  where estado <> 'rejeitada';

create index pedidos_fatura_estado_idx on public.pedidos_fatura (estado, pedido_em desc);
create index pedidos_fatura_cliente_idx on public.pedidos_fatura (cliente_id);
create index pedidos_fatura_pedido_por_idx on public.pedidos_fatura (pedido_por);
create index pedidos_fatura_resolvido_por_idx on public.pedidos_fatura (resolvido_por);
create index pedidos_fatura_estudio_idx on public.pedidos_fatura (estudio_id);

alter table public.pedidos_fatura enable row level security;

-- Toda a equipa do estúdio vê o estado do pedido (para saber se a
-- fatura já saiu); só pode criar pedidos pendentes.
create policy "ler_pedidos_fatura" on public.pedidos_fatura
  for select to authenticated
  using (tenho_estudio(estudio_id));

create policy "pedir_fatura" on public.pedidos_fatura
  for insert to authenticated
  with check (tenho_estudio(estudio_id) and estado = 'pendente');

-- Editar, emitir, rejeitar ou apagar: só a administração.
create policy "admin_editar_pedidos_fatura" on public.pedidos_fatura
  for update to authenticated
  using (e_admin()) with check (e_admin());

create policy "admin_apagar_pedidos_fatura" on public.pedidos_fatura
  for delete to authenticated
  using (e_admin());
