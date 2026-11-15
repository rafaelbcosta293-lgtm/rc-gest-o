import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/supabase/database.types'
import { permissoesDaConta } from './acessos'
import { chaveDaSessao, criarMemoria } from './memoria'

export type SessaoAtual = {
  userId: string | null
  email: string | null
  perfil: Pick<Perfil, 'id' | 'nome' | 'papel'> | null
  // Módulos que uma conta pessoal pode abrir e se pode editar a Agenda
  // (definidos pela Administração — ver permissoesDaConta).
  modulos: string[]
  agendaEscrita: boolean
}

// "Quem sou eu e qual é o meu papel" é preciso em quase todas as páginas
// (layout, gating de módulos, páginas que ajustam o que mostram consoante
// admin/gestão). Em cache() para que, dentro do mesmo pedido, isto corra
// uma única vez — layout.tsx e a página só pagam esta consulta uma vez,
// não duas ou três.
//
// E entre pedidos seguidos fica 30 segundos na memória do servidor (ver
// lib/data/memoria.ts): validar a sessão na Supabase e ler a ficha eram
// duas idas à rede, uma atrás da outra, em cada página aberta. Com isto,
// quem anda a navegar só as paga de meio em meio minuto. O preço: tirar
// o acesso a uma conta, ou mudar-lhe as permissões, pode demorar até 30
// segundos a notar-se nos menus — os dados em si continuam protegidos
// pela RLS em cada consulta, e as ações que gravam validam sempre a
// sessão na hora (chamam getUser() diretamente).
const VALIDADE_SESSAO_MS = 30_000
const memoriaSessao = criarMemoria<SessaoAtual>(VALIDADE_SESSAO_MS)

async function carregarSessao(supabase: Awaited<ReturnType<typeof createClient>>): Promise<SessaoAtual> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) {
    return { userId: null, email: null, perfil: null, ...permissoesDaConta(null) }
  }

  const { data: perfil } = await supabase
    .from('perfis')
    .select('id, nome, papel')
    .eq('id', user.id)
    .maybeSingle()

  return { userId: user.id, email: user.email ?? null, perfil, ...permissoesDaConta(user.app_metadata) }
}

export const getSessaoAtual = cache(async (): Promise<SessaoAtual> => {
  const supabase = await createClient()
  const chave = await chaveDaSessao(supabase)
  // Só fica guardada uma sessão válida e com ficha — "sem sessão" ou uma
  // ficha que ainda não existe perguntam-se outra vez no pedido seguinte.
  return memoriaSessao.obter(
    chave,
    () => carregarSessao(supabase),
    (sessao) => sessao.userId !== null && sessao.perfil !== null
  )
})

export function papeisDaSessao(sessao: SessaoAtual) {
  const ehAdmin = sessao.perfil?.papel === 'admin'
  const ehGestao = ehAdmin || sessao.perfil?.papel === 'studio_manager'
  return { ehAdmin, ehGestao }
}
