import type { SupabaseClient } from '@supabase/supabase-js'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import type { PagamentoAnalise } from './analiseFinanceira'

type LinhaPagamento = {
  cliente_id: string
  valor: number | string
  desconto: number | string | null
  metodo: string | null
  plano_id: string | null
  data_pagamento: string
  valido_ate: string
  clientes: { estudio_id: number } | { estudio_id: number }[]
}

// Todo o histórico de pagamentos (sem anulados) dos estúdios pedidos,
// no formato do motor de análise. Vários milhares de linhas: pede as
// páginas em paralelo.
export async function carregarPagamentosAnalise(
  supabase: SupabaseClient,
  idsEstudios: Set<number>
): Promise<PagamentoAnalise[]> {
  const { data, error } = await todasAsLinhas<LinhaPagamento>(
    (de, ate) =>
      supabase
        .from('pagamentos_ativos')
        .select('cliente_id, valor, desconto, metodo, plano_id, data_pagamento, valido_ate, clientes!inner(estudio_id)')
        .order('id')
        .range(de, ate),
    { emParalelo: 6 }
  )
  if (error) throw new Error(error.message)
  const pagamentos: PagamentoAnalise[] = []
  for (const p of data) {
    const c = Array.isArray(p.clientes) ? p.clientes[0] : p.clientes
    if (!c || !idsEstudios.has(c.estudio_id)) continue
    pagamentos.push({
      cliente_id: p.cliente_id,
      estudio_id: c.estudio_id,
      valor: Number(p.valor),
      desconto: Number(p.desconto ?? 0),
      metodo: p.metodo,
      plano_id: p.plano_id,
      data_pagamento: p.data_pagamento,
      valido_ate: p.valido_ate,
    })
  }
  return pagamentos
}
