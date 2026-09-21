import { createClient } from '@supabase/supabase-js'

// Cliente com a "service role key" — ignora todas as regras de segurança
// (RLS). Só pode ser usado dentro de ações do servidor ('use server'),
// nunca em código que corra no browser. É o único cliente com permissão
// para criar contas diretamente (auth.admin.createUser).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não está configurada nas variáveis de ambiente do projeto.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
