-- A policy "ler_config" (select, qual = true) deixa qualquer
-- "authenticated" ler TODA a tabela config — incluindo senha_admin e
-- senha_coordenacao (as passwords extra de acesso a Administração e
-- Coordenação). Antes de existirem contas de cliente isto era inofensivo
-- (só havia contas de equipa), mas uma conta de cliente autenticada
-- herdaria o mesmo acesso. Em vez de apagar/alterar a policy existente
-- (mantém-se exatamente como está, para a equipa), acrescenta-se uma
-- policy RESTRICTIVE: combina em AND com as permissivas, por isso limita
-- sempre o que "ler_config" já deixava passar, sem o substituir.
create policy "config so equipa ou regulamento ao cliente" on public.config
  as restrictive
  for select using (
    exists (select 1 from public.perfis where id = auth.uid())
    or (
      chave = 'regulamento'
      and exists (select 1 from public.clientes c where c.auth_user_id = auth.uid())
    )
  );
