import type { Enums } from "@/lib/supabase/database.types"

export type EstadoOrcamento = Enums<"estado_orcamento">
export type TipoLinhaOrcamento = Enums<"tipo_linha_orcamento">

export const NOMES_ESTADO_ORCAMENTO: Record<EstadoOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aceite: "Aceite",
  recusado: "Recusado",
}

/** Variante do Badge (components/ui/badge) para cada estado. */
export const VARIANTE_ESTADO_ORCAMENTO: Record<EstadoOrcamento, "secondary" | "default" | "outline" | "muted"> = {
  rascunho: "muted",
  enviado: "secondary",
  aceite: "default",
  recusado: "outline",
}

export const ESTADOS_ORCAMENTO: EstadoOrcamento[] = ["rascunho", "enviado", "aceite", "recusado"]

/**
 * Mudanças de estado possíveis (as mesmas que a BD aceita, em
 * app.regras_orcamento). Só o gerente muda o estado; o chefe faz rascunhos.
 * "aceite → enviado" só enquanto o orçamento não foi convertido em trabalho.
 */
export const TRANSICOES_ORCAMENTO: Record<EstadoOrcamento, EstadoOrcamento[]> = {
  rascunho: ["enviado"],
  enviado: ["aceite", "recusado", "rascunho"],
  aceite: ["enviado"],
  recusado: ["rascunho"],
}

/** Texto do botão que leva a cada estado. */
export const ACAO_ESTADO_ORCAMENTO: Record<EstadoOrcamento, string> = {
  rascunho: "Voltar a rascunho",
  enviado: "Marcar como enviado",
  aceite: "Marcar como aceite",
  recusado: "Marcar como recusado",
}

export function podeMudarEstado(de: EstadoOrcamento, para: EstadoOrcamento, convertido: boolean): boolean {
  if (de === "aceite" && convertido) return false
  return TRANSICOES_ORCAMENTO[de].includes(para)
}

/** Só o rascunho se altera (linhas incluídas). */
export function eEditavel(estado: EstadoOrcamento): boolean {
  return estado === "rascunho"
}

/** Enviado e com a validade ultrapassada (o estado não muda sozinho). */
export function estaExpirado(orcamento: { estado: EstadoOrcamento; validade: string }, hoje: string): boolean {
  return orcamento.estado === "enviado" && orcamento.validade < hoje
}

/** "2026/0007" */
export function formatarNumeroOrcamento(ano: number, numero: number): string {
  return `${ano}/${String(numero).padStart(4, "0")}`
}

export const NOMES_TIPO_LINHA: Record<TipoLinhaOrcamento, string> = {
  mao_de_obra: "Mão de obra",
  material: "Material",
  equipamento: "Equipamento",
  outros: "Outros",
}

/** Ordem dos grupos de linhas no editor e no PDF. */
export const TIPOS_LINHA: TipoLinhaOrcamento[] = ["mao_de_obra", "material", "equipamento", "outros"]

/** Taxas de IVA do Continente aceites pela BD (Açores e Madeira têm taxas próprias). */
export const TAXAS_IVA = [23, 13, 6, 0] as const
export type TaxaIva = (typeof TAXAS_IVA)[number]
export const TAXA_IVA_NORMAL: TaxaIva = 23

export function nomeTaxaIva(taxa: number): string {
  return taxa === 0 ? "Isento (0%)" : `${taxa}%`
}

/** Unidade proposta para cada tipo de linha. */
export const UNIDADE_POR_TIPO: Record<TipoLinhaOrcamento, string> = {
  mao_de_obra: "h",
  material: "un",
  equipamento: "dia",
  outros: "un",
}

export const UNIDADES_SUGERIDAS = ["h", "un", "m", "m²", "m³", "kg", "L", "dia", "serviço"]

// ---------------------------------------------------------------------
// Totais: as mesmas contas da BD (orcamento_linhas.total e
// app.recalcular_totais_orcamento), feitas em cêntimos inteiros para não
// haver diferenças de arredondamento entre o editor e o que fica gravado.
// ---------------------------------------------------------------------

export type LinhaParaTotal = { quantidade: number; preco_unitario: number; taxa_iva: number }

export type TotaisOrcamento = {
  /** Soma das linhas, sem IVA. */
  subtotal: number
  /** IVA por taxa (só as taxas usadas), da maior para a menor. */
  iva: { taxa: number; base: number; valor: number }[]
  totalIva: number
  total: number
}

/** Arredonda a divisão inteira a meio para cima (valores ≥ 0), como o round() do Postgres. */
function dividirArredondado(valor: bigint, divisor: bigint): bigint {
  return (valor + divisor / BigInt(2)) / divisor
}

function emCentimos(linha: LinhaParaTotal): bigint {
  // quantidade com 3 casas × preço com 2 casas = valor em 1/100 000 de euro.
  const milesimas = BigInt(Math.round(linha.quantidade * 1000))
  const centimos = BigInt(Math.round(linha.preco_unitario * 100))
  return dividirArredondado(milesimas * centimos, BigInt(1000))
}

/** Total de uma linha sem IVA (quantidade × preço, arredondado ao cêntimo). */
export function totalLinha(linha: LinhaParaTotal): number {
  return Number(emCentimos(linha)) / 100
}

export function calcularTotais(linhas: LinhaParaTotal[]): TotaisOrcamento {
  const basePorTaxa = new Map<number, bigint>()
  let subtotal = BigInt(0)
  for (const linha of linhas) {
    const centimos = emCentimos(linha)
    subtotal += centimos
    basePorTaxa.set(linha.taxa_iva, (basePorTaxa.get(linha.taxa_iva) ?? BigInt(0)) + centimos)
  }
  let totalIva = BigInt(0)
  const iva = [...basePorTaxa.entries()]
    .sort(([a], [b]) => b - a)
    .map(([taxa, base]) => {
      const valor = dividirArredondado(base * BigInt(Math.round(taxa * 100)), BigInt(10_000))
      totalIva += valor
      return { taxa, base: Number(base) / 100, valor: Number(valor) / 100 }
    })
  return {
    subtotal: Number(subtotal) / 100,
    iva,
    totalIva: Number(totalIva) / 100,
    total: Number(subtotal + totalIva) / 100,
  }
}
