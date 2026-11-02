-- "pagamentos" só tinha uma política (admin_pagamentos, FOR ALL, só
-- admin) — sem nenhuma política de escrita para gestão/coordenação,
-- registar um pagamento dava sempre "new row violates row-level
-- security policy", mesmo tendo acesso ao estúdio do cliente. Mesmo
-- padrão já usado em presencas/avaliacoes: escrita restrita a quem
-- tem acesso ao estúdio do cliente (via tenho_estudio), sem
-- necessidade de leitura pelo próprio cliente (esta tabela só é lida
-- pela app de gestão).

drop policy if exists "admin_pagamentos" on public.pagamentos;

create policy "escrever_pagamentos" on public.pagamentos
  for insert
  with check (
    exists (
      select 1 from public.clientes c
      where c.id = pagamentos.cliente_id and tenho_estudio(c.estudio_id)
    )
  );

create policy "editar_pagamentos" on public.pagamentos
  for update
  using (
    exists (
      select 1 from public.clientes c
      where c.id = pagamentos.cliente_id and tenho_estudio(c.estudio_id)
    )
  )
  with check (
    exists (
      select 1 from public.clientes c
      where c.id = pagamentos.cliente_id and tenho_estudio(c.estudio_id)
    )
  );

create policy "apagar_pagamentos" on public.pagamentos
  for delete
  using (
    exists (
      select 1 from public.clientes c
      where c.id = pagamentos.cliente_id and tenho_estudio(c.estudio_id)
    )
  );

create policy "ler_pagamentos" on public.pagamentos
  for select
  using (
    exists (
      select 1 from public.clientes c
      where c.id = pagamentos.cliente_id and tenho_estudio(c.estudio_id)
    )
  );
