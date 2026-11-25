import { redirect } from 'next/navigation'
import { cache } from 'react'
import { criarSupabase } from './supabase'

export type Conta = {
  id: string
  numero: string
  nome: string
  estudio_nome: string
  estudio_slug: string
  ativa: boolean
  // Tem o serviço "Aulas Virtuais" em dia (vê as aulas em vídeo).
  aulas_virtuais: boolean
}
export type AulaVirtual = {
  id: string
  titulo: string
  descricao: string | null
  categoria: string
  nivel: string | null
  duracao_min: number | null
  youtube_id: string
  ordem: number
}
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
  const { data } = await supabase.from('contas').select('id, numero, nome, estudio_nome, estudio_slug, ativa, aulas_virtuais').eq('id', user.id).maybeSingle()
  if (!data || !data.ativa) {
    await supabase.auth.signOut()
    redirect('/entrar')
  }
  return data as Conta
})

// As aulas em vídeo, pela ordem escolhida pelo estúdio. Vem vazio para
// quem não tem o serviço (a base de dados não as mostra).
export const aulasVirtuais = cache(async (): Promise<AulaVirtual[]> => {
  const supabase = await criarSupabase()
  const { data } = await supabase
    .from('aulas_virtuais')
    .select('id, titulo, descricao, categoria, nivel, duracao_min, youtube_id, ordem')
    .order('ordem')
    .order('titulo')
  return (data ?? []) as AulaVirtual[]
})

// Quantas aulas em vídeo existem (visível a todas as contas — para as
// dar a conhecer a quem ainda não tem o serviço).
export async function totalAulasVirtuais(): Promise<number> {
  const supabase = await criarSupabase()
  const { data } = await supabase.from('info').select('valor').eq('chave', 'aulas_virtuais').maybeSingle()
  return Number(data?.valor) || 0
}

export async function pedidosEmCurso(): Promise<Pedido[]> {
  const supabase = await criarSupabase()
  const { data } = await supabase
    .from('pedidos')
    .select('id, tipo, alvo, estado, resposta, criado_em')
    .order('criado_em', { ascending: false })
    .limit(50)
  return (data ?? []) as Pedido[]
}
