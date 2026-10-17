import type { Enums } from "@/lib/supabase/database.types"

export type FrequenciaContrato = Enums<"frequencia_contrato">
export type EstadoContrato = Enums<"estado_contrato">
export type OrigemCobranca = Enums<"origem_cobranca">
export type EstadoCobranca = Enums<"estado_cobranca">
export type MetodoPagamento = Enums<"metodo_pagamento">

type VarianteBadge = "default" | "secondary" | "destructive" | "outline" | "muted"

// ---------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------

export const FREQUENCIAS_CONTRATO: FrequenciaContrato[] = ["semanal", "quinzenal", "mensal"]

export const NOMES_FREQUENCIA_CONTRATO: Record<FrequenciaContrato, string> = {
  semanal: "Todas as semanas",
  quinzenal: "De 15 em 15 dias",
  mensal: "Todos os meses",
}

export const ESTADOS_CONTRATO: EstadoContrato[] = ["ativo", "suspenso", "terminado"]

export const NOMES_ESTADO_CONTRATO: Record<EstadoContrato, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  terminado: "Terminado",
}

export const VARIANTE_ESTADO_CONTRATO: Record<EstadoContrato, VarianteBadge> = {
  ativo: "default",
  suspenso: "outline",
  terminado: "muted",
}

/** Taxas de IVA aceites pela BD nos contratos (as mesmas dos orçamentos). */
export const TAXAS_IVA_CONTRATO = [23, 13, 6, 0] as const

/** As visitas dos contratos ficam na agenda com esta antecedência (igual à BD). */
export const SEMANAS_AGENDADAS = 8

/** Valor mensal com IVA, arredondado ao cêntimo (as mesmas contas da BD). */
export function valorMensalComIva(valorSemIva: number, taxaIva: number): number {
  return Math.round(valorSemIva * (100 + taxaIva)) / 100
}

// ---------------------------------------------------------------------
// Cobranças e pagamentos
// ---------------------------------------------------------------------

export const NOMES_ORIGEM_COBRANCA: Record<OrigemCobranca, string> = {
  contrato: "Avença",
  orcamento: "Orçamento",
  avulsa: "Avulsa",
}

export const ESTADOS_COBRANCA: EstadoCobranca[] = ["por_pagar", "parcial", "atrasada", "paga"]

export const NOMES_ESTADO_COBRANCA: Record<EstadoCobranca, string> = {
  por_pagar: "Por pagar",
  parcial: "Paga em parte",
  atrasada: "Em atraso",
  paga: "Paga",
}

export const VARIANTE_ESTADO_COBRANCA: Record<EstadoCobranca, VarianteBadge> = {
  por_pagar: "secondary",
  parcial: "outline",
  atrasada: "destructive",
  paga: "muted",
}

export const METODOS_PAGAMENTO: MetodoPagamento[] = [
  "transferencia",
  "mbway",
  "multibanco",
  "numerario",
  "cheque",
  "outro",
]

export const NOMES_METODO_PAGAMENTO: Record<MetodoPagamento, string> = {
  transferencia: "Transferência",
  mbway: "MB WAY",
  multibanco: "Multibanco",
  numerario: "Numerário",
  cheque: "Cheque",
  outro: "Outro",
}

const NOMES_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

/** "2026-10-01" → "outubro de 2026" (mês de uma avença). */
export function formatarMes(data: string): string {
  const [ano, mes] = data.split("-").map(Number)
  return `${NOMES_MESES[mes - 1]} de ${ano}`
}

/** "Há 1 dia", "Há 12 dias" (atraso de uma cobrança). */
export function descreverAtraso(dias: number): string {
  return dias === 1 ? "Há 1 dia" : `Há ${dias} dias`
}
