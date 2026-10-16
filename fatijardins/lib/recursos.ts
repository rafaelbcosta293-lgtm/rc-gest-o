import { somarDias } from "@/lib/formatar"
import type { Enums } from "@/lib/supabase/database.types"

export type TipoEquipamento = Enums<"tipo_equipamento">
export type EstadoEquipamento = Enums<"estado_equipamento">
export type TipoManutencao = Enums<"tipo_manutencao">
export type TipoMovimentoStock = Enums<"tipo_movimento_stock">

// ---------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------

export const TIPOS_EQUIPAMENTO: TipoEquipamento[] = ["viatura", "maquina", "ferramenta", "outro"]

export const NOMES_TIPO_EQUIPAMENTO: Record<TipoEquipamento, string> = {
  viatura: "Viatura",
  maquina: "Máquina",
  ferramenta: "Ferramenta",
  outro: "Outro",
}

export const ESTADOS_EQUIPAMENTO: EstadoEquipamento[] = ["operacional", "avariado", "em_reparacao", "abatido"]

export const NOMES_ESTADO_EQUIPAMENTO: Record<EstadoEquipamento, string> = {
  operacional: "Operacional",
  avariado: "Avariado",
  em_reparacao: "Em reparação",
  abatido: "Abatido",
}

/** Variante do Badge (components/ui/badge) para cada estado. */
export const VARIANTE_ESTADO_EQUIPAMENTO: Record<
  EstadoEquipamento,
  "default" | "secondary" | "destructive" | "outline" | "muted"
> = {
  operacional: "secondary",
  avariado: "destructive",
  em_reparacao: "outline",
  abatido: "muted",
}

/**
 * Estados que o chefe de equipa pode escolher (a BD não o deixa abater nem
 * tirar do abate; isso é do gerente).
 */
export const ESTADOS_CHEFE: EstadoEquipamento[] = ["operacional", "avariado", "em_reparacao"]

export const TIPOS_MANUTENCAO: TipoManutencao[] = ["revisao", "reparacao", "ipo", "seguro", "outra"]

export const NOMES_TIPO_MANUTENCAO: Record<TipoManutencao, string> = {
  revisao: "Revisão",
  reparacao: "Reparação",
  ipo: "Inspeção (IPO)",
  seguro: "Seguro",
  outra: "Outra",
}

/** Formato das matrículas portuguesas (o mesmo que a BD aceita): AA-12-BC. */
export const FORMATO_MATRICULA = /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/

/** "aa12bc", "AA 12 BC" ou "aa-12-bc" → "AA-12-BC" (o resto fica como está). */
export function normalizarMatricula(valor: string): string {
  const limpo = valor.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return limpo.length === 6 ? `${limpo.slice(0, 2)}-${limpo.slice(2, 4)}-${limpo.slice(4)}` : valor.trim().toUpperCase()
}

// ---------------------------------------------------------------------
// Alertas dos equipamentos (revisão, seguro e IPO)
// ---------------------------------------------------------------------

/** Os alertas aparecem quando faltam até 30 dias (ou a data já passou). */
export const DIAS_AVISO = 30

export type TipoPrazo = "revisao" | "seguro" | "ipo"

export const NOMES_PRAZO: Record<TipoPrazo, string> = {
  revisao: "Revisão",
  seguro: "Seguro",
  ipo: "IPO",
}

export type AlertaPrazo = {
  tipo: TipoPrazo
  data: string
  /** Dias que faltam (negativo se já passou; 0 = hoje). */
  dias: number
  vencido: boolean
}

type DatasEquipamento = {
  estado: EstadoEquipamento
  proxima_revisao: string | null
  seguro_ate: string | null
  ipo_ate: string | null
}

/** Diferença em dias entre duas datas aaaa-mm-dd (b - a). */
export function diasEntre(a: string, b: string): number {
  const [anoA, mesA, diaA] = a.split("-").map(Number)
  const [anoB, mesB, diaB] = b.split("-").map(Number)
  return Math.round((Date.UTC(anoB, mesB - 1, diaB) - Date.UTC(anoA, mesA - 1, diaA)) / 86_400_000)
}

/**
 * Prazos (revisão, seguro, IPO) que vencem nos próximos 30 dias ou já
 * venceram, do mais urgente para o menos. Equipamentos abatidos não têm
 * alertas.
 */
export function alertasEquipamento(equipamento: DatasEquipamento, hoje: string): AlertaPrazo[] {
  if (equipamento.estado === "abatido") return []
  const limite = somarDias(hoje, DIAS_AVISO)
  const prazos: [TipoPrazo, string | null][] = [
    ["revisao", equipamento.proxima_revisao],
    ["seguro", equipamento.seguro_ate],
    ["ipo", equipamento.ipo_ate],
  ]
  return prazos
    .filter((prazo): prazo is [TipoPrazo, string] => prazo[1] !== null && prazo[1] <= limite)
    .map(([tipo, data]) => {
      const dias = diasEntre(hoje, data)
      return { tipo, data, dias, vencido: dias < 0 }
    })
    .sort((a, b) => a.dias - b.dias)
}

/** "Seguro termina amanhã", "IPO venceu há 3 dias", "Revisão daqui a 10 dias". */
export function descreverAlerta(alerta: AlertaPrazo): string {
  const nome = NOMES_PRAZO[alerta.tipo]
  const dias = Math.abs(alerta.dias)
  const quantos = dias === 1 ? "1 dia" : `${dias} dias`
  if (alerta.tipo === "revisao") {
    if (alerta.dias === 0) return "Revisão prevista para hoje"
    if (alerta.dias === 1) return "Revisão amanhã"
    return alerta.dias > 0 ? `Revisão daqui a ${quantos}` : `Revisão em atraso há ${quantos}`
  }
  if (alerta.dias === 0) return `${nome} termina hoje`
  if (alerta.dias === 1) return `${nome} termina amanhã`
  return alerta.dias > 0 ? `${nome} termina daqui a ${quantos}` : `${nome} venceu há ${quantos}`
}

// ---------------------------------------------------------------------
// Consumíveis e stock
// ---------------------------------------------------------------------

export const TIPOS_MOVIMENTO: TipoMovimentoStock[] = ["entrada", "saida", "ajuste"]

export const NOMES_TIPO_MOVIMENTO: Record<TipoMovimentoStock, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Acerto",
}

/**
 * Stock baixo: está no mínimo ou abaixo dele (só para consumíveis ativos
 * com mínimo definido).
 */
export function eStockBaixo(consumivel: { ativo: boolean; stock_minimo: number }, stock: number): boolean {
  return consumivel.ativo && consumivel.stock_minimo > 0 && stock <= consumivel.stock_minimo
}

/** Quantidade com a unidade: "12,5 kg", "3 un". */
export function formatarQuantidade(quantidade: number, unidade: string): string {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3, useGrouping: "always" }).format(quantidade)} ${unidade}`
}
