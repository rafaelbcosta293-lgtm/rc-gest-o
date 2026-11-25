-- Desativar uma conta bloqueava-a com a data "infinity", que o serviço de
-- contas do Supabase não consegue ler (dava erro em vez de "conta
-- bloqueada", e partia a lista de utilizadores). Passa a ser um bloqueio
-- de 100 anos, e corrigem-se as contas que já estavam assim.
create or replace function public.sync_desativar_conta(p_token text, p_conta uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_token(p_token);
  update public.contas set ativa = false, atualizado_em = now() where id = p_conta;
  update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = p_conta;
  delete from auth.sessions where user_id = p_conta;
  delete from privado.convites where conta_id = p_conta;
  delete from public.inscricoes where conta_id = p_conta;
  delete from public.treinos where conta_id = p_conta;
  delete from public.presencas where conta_id = p_conta;
  delete from public.avaliacoes where conta_id = p_conta;
end $$;

update auth.users set banned_until = now() + interval '100 years', updated_at = now() where banned_until = 'infinity';
