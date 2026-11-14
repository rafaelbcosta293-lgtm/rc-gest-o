import type { SupabaseClient } from '@supabase/supabase-js'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import type { Despesa, PagamentoAnalise } from './analiseFinanceira'

type LinhaPagamento = {
  cliente_id: string
  valor: number | string
  desconto: number | string | null
  metodo: string | null
  plano_id: string | null
  data_pagamento: string
  valido_ate: string
  mensalidade: boolean | null
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
        .select('cliente_id, valor, desconto, metodo, plano_id, data_pagamento, valido_ate, mensalidade, clientes!inner(estudio_id)')
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
      mensalidade: p.mensalidade !== false,
    })
  }
  return pagamentos
}

// Receitas sem cliente (bar, merchandising, apoios, osteopatia… e os
// ajustes de reconciliação com o Excel), no mesmo formato dos
// pagamentos para entrarem nas contas de receita.
export async function carregarOutrasReceitas(
  supabase: SupabaseClient,
  idsEstudios: Set<number>
): Promise<PagamentoAnalise[]> {
  const { data, error } = await todasAsLinhas<{
    estudio_id: number
    data: string
    categoria: string
    valor: number | string
    metodo: string | null
  }>((de, ate) =>
    supabase
      .from('receitas_outras')
      .select('estudio_id, data, categoria, valor, metodo')
      .is('anulado_em', null)
      .order('id')
      .range(de, ate)
  )
  if (error) throw new Error(error.message)
  return data
    .filter((r) => idsEstudios.has(r.estudio_id))
    .map((r) => ({
      cliente_id: '',
      estudio_id: r.estudio_id,
      valor: Number(r.valor),
      desconto: 0,
      metodo: r.metodo,
      plano_id: null,
      data_pagamento: r.data,
      valido_ate: r.data,
      outra: r.categoria,
    }))
}

export async function carregarDespesas(supabase: SupabaseClient, idsEstudios: Set<number>): Promise<Despesa[]> {
  const { data, error } = await todasAsLinhas<{
    estudio_id: number
    data: string
    categoria: string
    subcategoria: string | null
    valor: number | string
  }>(
    (de, ate) =>
      supabase
        .from('despesas')
        .select('estudio_id, data, categoria, subcategoria, valor')
        .is('anulado_em', null)
        .order('id')
        .range(de, ate),
    { emParalelo: 2 }
  )
  if (error) throw new Error(error.message)
  return data.filter((d) => idsEstudios.has(d.estudio_id)).map((d) => ({ ...d, valor: Number(d.valor) }))
}
