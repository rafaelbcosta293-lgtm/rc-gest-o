import "server-only"

import type { EstadoCobranca, OrigemCobranca } from "@/lib/financas"
import type { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Uma cobrança com o saldo (da vista cobrancas_com_saldo), sem os "| null" dos tipos das vistas. */
export type CobrancaSaldo = {
  id: string
  clienteId: string
  cliente: string
  localId: string | null
  origem: OrigemCobranca
  contratoId: string | null
  orcamentoId: string | null
  descricao: string
  periodo: string | null
  dataEmissao: string
  dataVencimento: string
  valor: number
  pago: number
  emDivida: number
  estado: EstadoCobranca
  diasAtraso: number
  faturaReferencia: string | null
  faturaData: string | null
  notas: string | null
  updatedAt: string
}

export const COLUNAS_COBRANCA = `id, cliente_id, local_id, origem, contrato_id, orcamento_id, descricao, periodo,
  data_emissao, data_vencimento, valor, pago, em_divida, estado, dias_atraso, fatura_referencia, fatura_data,
  notas, updated_at, cliente:clientes(nome)`

type LinhaVista = {
  id: string | null
  cliente_id: string | null
  local_id: string | null
  origem: OrigemCobranca | null
  contrato_id: string | null
  orcamento_id: string | null
  descricao: string | null
  periodo: string | null
  data_emissao: string | null
  data_vencimento: string | null
  valor: number | null
  pago: number | null
  em_divida: number | null
  estado: EstadoCobranca | null
  dias_atraso: number | null
  fatura_referencia: string | null
  fatura_data: string | null
  notas: string | null
  updated_at: string | null
  cliente: { nome: string } | null
}

/** As colunas da vista vêm como "| null" nos tipos gerados, mas nunca o são (vêm da tabela). */
export function paraCobranca(linha: LinhaVista): CobrancaSaldo {
  return {
    id: linha.id ?? "",
    clienteId: linha.cliente_id ?? "",
    cliente: linha.cliente?.nome ?? "—",
    localId: linha.local_id,
    origem: linha.origem ?? "avulsa",
    contratoId: linha.contrato_id,
    orcamentoId: linha.orcamento_id,
    descricao: linha.descricao ?? "",
    periodo: linha.periodo,
    dataEmissao: linha.data_emissao ?? "",
    dataVencimento: linha.data_vencimento ?? "",
    valor: Number(linha.valor ?? 0),
    pago: Number(linha.pago ?? 0),
    emDivida: Number(linha.em_divida ?? 0),
    estado: linha.estado ?? "por_pagar",
    diasAtraso: Number(linha.dias_atraso ?? 0),
    faturaReferencia: linha.fatura_referencia,
    faturaData: linha.fatura_data,
    notas: linha.notas,
    updatedAt: linha.updated_at ?? "",
  }
}

const POR_PAGINA = 1000

/** Todas as cobranças (aos blocos de 1000, o limite da API do Supabase por pedido). */
export async function carregarCobrancas(supabase: Supabase): Promise<CobrancaSaldo[]> {
  const todas: CobrancaSaldo[] = []
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const { data, error } = await supabase
      .from("cobrancas_com_saldo")
      .select(COLUNAS_COBRANCA)
      .order("data_vencimento")
      .order("id")
      .range(inicio, inicio + POR_PAGINA - 1)
    if (error) throw new Error(`Erro ao carregar as cobranças: ${error.message}`)
    todas.push(...data.map(paraCobranca))
    if (data.length < POR_PAGINA) return todas
  }
}

/** Em atraso primeiro (as mais atrasadas à frente), depois por vencimento (as pagas no fim). */
export function ordenarCobrancas(cobrancas: CobrancaSaldo[]): CobrancaSaldo[] {
  return [...cobrancas].sort(
    (a, b) =>
      Number(b.estado === "atrasada") - Number(a.estado === "atrasada") ||
      b.diasAtraso - a.diasAtraso ||
      Number(a.estado === "paga") - Number(b.estado === "paga") ||
      a.dataVencimento.localeCompare(b.dataVencimento)
  )
}

/** Soma em euros sem erros de vírgula flutuante. */
export function somar(valores: number[]): number {
  return Math.round(valores.reduce((total, valor) => total + Math.round(valor * 100), 0)) / 100
}
