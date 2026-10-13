/**
 * Formatação para Portugal: datas dd/mm/aaaa, euros "1 234,56 €",
 * fuso horário Europe/Lisbon.
 */
export const FUSO_HORARIO = "Europe/Lisbon"

const formatoData = new Intl.DateTimeFormat("pt-PT", {
  timeZone: FUSO_HORARIO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const formatoDataHora = new Intl.DateTimeFormat("pt-PT", {
  timeZone: FUSO_HORARIO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const formatoDataExtenso = new Intl.DateTimeFormat("pt-PT", {
  timeZone: FUSO_HORARIO,
  weekday: "long",
  day: "numeric",
  month: "long",
})

const formatoMoeda = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
})

const formatoNumero = new Intl.NumberFormat("pt-PT", {
  maximumFractionDigits: 2,
  useGrouping: "always",
})

const DATA_SIMPLES = /^(\d{4})-(\d{2})-(\d{2})$/

/** Datas sem hora (colunas date, "2026-10-12") não sofrem conversão de fuso. */
export function formatarData(valor: string | Date | null | undefined): string {
  if (!valor) return ""
  if (typeof valor === "string") {
    const simples = DATA_SIMPLES.exec(valor)
    if (simples) return `${simples[3]}/${simples[2]}/${simples[1]}`
  }
  const data = typeof valor === "string" ? new Date(valor) : valor
  return Number.isNaN(data.getTime()) ? "" : formatoData.format(data)
}

export function formatarDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return ""
  const data = typeof valor === "string" ? new Date(valor) : valor
  return Number.isNaN(data.getTime()) ? "" : formatoDataHora.format(data).replace(",", "")
}

/** Ex.: "terça-feira, 13 de outubro". */
export function formatarDataExtenso(valor: Date): string {
  return formatoDataExtenso.format(valor)
}

/** Ex.: 1234.56 → "1 234,56 €". */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return ""
  return formatoMoeda.format(valor)
}

export function formatarNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return ""
  return formatoNumero.format(valor)
}

export function formatarArea(valor: number | null | undefined): string {
  const numero = formatarNumero(valor)
  return numero ? `${numero} m²` : ""
}

/** Data de hoje em Lisboa no formato da base de dados (aaaa-mm-dd). */
export function hojeEmLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_HORARIO }).format(agora)
}

/** Soma dias a uma data aaaa-mm-dd (sem problemas de fuso horário). */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number)
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return resultado.toISOString().slice(0, 10)
}
