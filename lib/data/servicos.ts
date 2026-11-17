import type { SupabaseClient } from '@supabase/supabase-js'
import type { Servico } from '@/lib/supabase/database.types'

// Os serviços do estúdio. O Treino Personalizado é o id 1: é o serviço
// por omissão de tudo o que não diz outro (e de todo o histórico).
export const SERVICO_PT = 1

export async function carregarServicos(supabase: SupabaseClient, { soAtivos = false } = {}): Promise<Servico[]> {
  let q = supabase.from('servicos').select('id, chave, nome, formato, ordem, ativo, lotacao_omissao, reserva_abre_horas').order('ordem')
  if (soAtivos) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Servico[]
}

// Agrupa uma lista (ex.: planos) pelo serviço, pela ordem dos serviços;
// grupos vazios ficam de fora.
export function agruparPorServico<T extends { servico_id: number }>(
  itens: T[],
  servicos: Pick<Servico, 'id' | 'nome'>[]
): { servico: Pick<Servico, 'id' | 'nome'>; itens: T[] }[] {
  return servicos
    .map((servico) => ({ servico, itens: itens.filter((i) => i.servico_id === servico.id) }))
    .filter((g) => g.itens.length > 0)
}

// "servico_id" de um formulário: número válido ou null (= do estúdio).
export function servicoDoFormulario(formData: FormData, campo = 'servico_id'): number | null {
  const v = Number(formData.get(campo))
  return Number.isInteger(v) && v > 0 ? v : null
}
