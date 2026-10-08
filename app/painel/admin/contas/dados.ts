import { createAdminClient } from '@/lib/supabase/admin'

// O email de login não existe em "perfis" (só em auth.users), por isso
// só dá para resolver "qual é o id desta conta" através da API de
// administração — não há como fazer isto com uma consulta normal.
export async function resolverIdPorEmail(email: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    throw new Error(error.message)
  }
  const alvo = email.trim().toLowerCase()
  const utilizador = data.users.find((u) => (u.email ?? '').toLowerCase() === alvo)
  return utilizador?.id ?? null
}
