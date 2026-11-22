import { redirect } from 'next/navigation'
import { cache } from 'react'
import { criarSupabase } from './supabase'

export type Conta = { id: string; numero: string; nome: string; estudio_nome: string; estudio_slug: string; ativa: boolean }
export type Aula = {
  id: string
  servico: string
  data: string
  hora_inicio: string
  duracao_min: number
  instrutor: string | null
  lotacao: number
  ocupadas: number
  estado: string
  reserva_abre_em: string | null
  cancelar_ate: string | null
}
export type Treino = { id: string; data: string; hora_inicio: string; duracao_min: number; servico: string | null; instrutor: string | null; estado: string }
export type Pedido = { id: string; tipo: string; alvo: string; estado: string; resposta: string | null; criado_em: string }
export type Presenca = { id: string; data: string; estado: string; tipo: string }
export type Avaliacao = {
  id: string
  data: string
  peso_kg: number | null
  massa_gorda_pct: number | null
  massa_muscular_kg: number | null
  gordura_visceral: number | null
  hidratacao_pct: number | null
  imc: number | null
  idade_metabolica: number | null
  proxima_reavaliacao: string | null
}

// Conta com sessão iniciada (valida o token no servidor de Auth).
export const contaAtual = cache(async (): Promise<Conta> => {
  const supabase = await criarSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  const { data } = await supabase.from('contas').select('id, numero, nome, estudio_nome, estudio_slug, ativa').eq('id', user.id).maybeSingle()
  if (!data || !data.ativa) {
    await supabase.auth.signOut()
    redirect('/entrar')
  }
  return data as Conta
})

export async function pedidosEmCurso(): Promise<Pedido[]> {
  const supabase = await criarSupabase()
  const { data } = await supabase
    .from('pedidos')
    .select('id, tipo, alvo, estado, resposta, criado_em')
    .order('criado_em', { ascending: false })
    .limit(50)
  return (data ?? []) as Pedido[]
}
