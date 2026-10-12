import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Cliente } from '@/lib/supabase/database.types'

export type SessaoCliente = {
  userId: string | null
  cliente: Cliente | null
}

// Mesmo padrão de getSessaoAtual (lib/data/sessao.ts), mas para a conta
// de cliente — "cliente" aqui é a ficha ligada por auth_user_id, nunca
// um perfil de equipa. cache() para só correr uma vez por pedido.
export const getSessaoCliente = cache(async (): Promise<SessaoCliente> => {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) {
    return { userId: null, cliente: null }
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  return { userId: user.id, cliente: cliente as Cliente | null }
})
