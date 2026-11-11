import type { SupabaseClient } from '@supabase/supabase-js'
import { montarRascunho, chaveProduto, type TipoLinhaFatura } from './faturas'

const TIPOS_LINHA: TipoLinhaFatura[] = ['mensalidade', 'inscricao', 'seguro', 'reativacao', 'outro']

// Chaves de "config" usadas para pré-preencher o rascunho.
export const CHAVES_CONFIG_FATURA = [
  'taxa_inscricao',
  'seguro_anual',
  'taxa_reativacao',
  ...TIPOS_LINHA.map(chaveProduto),
]

export async function lerConfigFatura(supabase: SupabaseClient) {
  const { data } = await supabase.from('config').select('chave, valor').or(
    `chave.in.(${CHAVES_CONFIG_FATURA.join(',')}),chave.like.zsgo_metodo_*`
  )
  return Object.fromEntries((data ?? []).map((l) => [l.chave as string, l.valor as string | null]))
}

// Cria um pedido de fatura pendente para um pagamento, com o rascunho já
// pré-preenchido. Devolve uma mensagem de erro (ou null se correu bem).
// Não emite nada: só a Administração emite, depois de validar.
export async function criarPedidoFatura(
  supabase: SupabaseClient,
  { pagamentoId, pedidoPor, nota }: { pagamentoId: string; pedidoPor: string | null; nota?: string | null }
): Promise<string | null> {
  const { data: pagamento, error: erroPag } = await supabase
    .from('pagamentos')
    .select(
      'id, cliente_id, valor, metodo, data_pagamento, valido_ate, inclui_inscricao, inclui_seguro, inclui_reativacao, nota, anulado_em, plano:planos(nome, valor), cliente:clientes(id, nome, nif, morada, codigo_postal, cidade, email, estudio_id)'
    )
    .eq('id', pagamentoId)
    .maybeSingle()

  if (erroPag) return erroPag.message
  if (!pagamento) return 'Pagamento não encontrado.'
  if (pagamento.anulado_em) return 'Este pagamento foi anulado — não pode ser faturado.'

  const cliente = pagamento.cliente as unknown as {
    id: string
    nome: string
    nif: string | null
    morada: string | null
    codigo_postal: string | null
    cidade: string | null
    email: string | null
    estudio_id: number
  } | null
  if (!cliente) return 'Cliente do pagamento não encontrado.'

  const config = await lerConfigFatura(supabase)
  const rascunho = montarRascunho({
    pagamento: {
      valor: Number(pagamento.valor),
      metodo: pagamento.metodo,
      data_pagamento: pagamento.data_pagamento,
      valido_ate: pagamento.valido_ate,
      inclui_inscricao: pagamento.inclui_inscricao,
      inclui_seguro: pagamento.inclui_seguro,
      inclui_reativacao: pagamento.inclui_reativacao,
      nota: pagamento.nota,
    },
    plano: pagamento.plano as unknown as { nome: string; valor: number } | null,
    cliente,
    config,
  })

  const { error } = await supabase.from('pedidos_fatura').insert({
    pagamento_id: pagamento.id,
    cliente_id: cliente.id,
    estudio_id: cliente.estudio_id,
    rascunho,
    nota_pedido: nota ?? null,
    pedido_por: pedidoPor,
  })

  if (error) {
    // Índice único: já existe um pedido ativo para este pagamento.
    if (error.code === '23505') return 'Já existe um pedido de fatura para este pagamento.'
    return error.message
  }
  return null
}
