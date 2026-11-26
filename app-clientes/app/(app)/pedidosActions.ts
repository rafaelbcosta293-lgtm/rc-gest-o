'use server'

import { revalidatePath } from 'next/cache'
import { criarSupabase } from '@/lib/supabase'

// O cliente só cria PEDIDOS; a gestão valida-os (vagas, janela de reserva,
// mensalidade, prazos) e responde na volta seguinte (até um minuto depois).
export type ResultadoPedido = { id: string } | { erro: string }
export type TipoPedido = 'inscrever_aula' | 'cancelar_aula' | 'desmarcar_treino'

export async function criarPedido(tipo: TipoPedido, alvo: string, nota?: string): Promise<ResultadoPedido> {
  if (!['inscrever_aula', 'cancelar_aula', 'desmarcar_treino'].includes(tipo)) return { erro: 'Pedido inválido.' }
  if (!/^[0-9a-f-]{36}$/i.test(alvo)) return { erro: 'Pedido inválido.' }
  const supabase = await criarSupabase()
  const { data, error } = await supabase
    .from('pedidos')
    .insert({ tipo, alvo, nota: nota?.trim().slice(0, 300) || null })
    .select('id')
    .single()
  // Erros das regras da base de dados (raise exception) já vêm em
  // português para o cliente; os restantes ficam genéricos.
  if (error || !data) return { erro: error?.code === 'P0001' ? error.message : 'Não foi possível enviar o pedido. Tente de novo.' }
  return { id: data.id as string }
}

export async function estadoPedido(id: string): Promise<{ estado: string; resposta: string | null } | null> {
  const supabase = await criarSupabase()
  const { data } = await supabase.from('pedidos').select('estado, resposta').eq('id', id).maybeSingle()
  return data ?? null
}

export async function atualizar() {
  revalidatePath('/', 'layout')
}
