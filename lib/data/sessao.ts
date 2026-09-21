import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/supabase/database.types'

export type SessaoAtual = {
  userId: string | null
  email: string | null
  perfil: Pick<Perfil, 'id' | 'nome' | 'papel'> | null
}

// "Quem sou eu e qual é o meu papel" é preciso em quase todas as páginas
// (layout, gating de módulos, páginas que ajustam o que mostram consoante
// admin/gestão). Em cache() para que, dentro do mesmo pedido, isto corra
// uma única vez — layout.tsx e a página só pagam esta consulta uma vez,
// não duas ou três.
export const getSessaoAtual = cache(async (): Promise<SessaoAtual> => {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) {
    return { userId: null, email: null, perfil: null }
  }

  const { data: perfil } = await supabase
    .from('perfis')
    .select('id, nome, papel')
    .eq('id', user.id)
    .maybeSingle()

  return { userId: user.id, email: user.email ?? null, perfil }
})

export function papeisDaSessao(sessao: SessaoAtual) {
  const ehAdmin = sessao.perfil?.papel === 'admin'
  const ehGestao = ehAdmin || sessao.perfil?.papel === 'studio_manager'
  return { ehAdmin, ehGestao }
}
