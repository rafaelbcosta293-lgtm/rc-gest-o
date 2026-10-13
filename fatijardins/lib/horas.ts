/**
 * Cálculo das horas picadas (funções puras, sem base de dados).
 *
 * - Cada período conta para o dia da ENTRADA (em Lisboa).
 * - Os minutos de um período contam-se entre as horas ao minuto (os
 *   segundos são ignorados), para baterem certo com "08:25–12:40".
 * - Um período aberto conta até agora, mas nunca para lá do fim do dia
 *   da entrada (uma saída esquecida não soma dias inteiros).
 * - Dias úteis: até 8 h são normais, o resto é extra. Fins de semana e
 *   feriados nacionais: todas as horas são extra.
 */
import { diasEntre, eDataValida, eFimDeSemana, feriadoNacional, ultimoDiaDoMes } from "@/lib/datas"
import { FUSO_HORARIO, hojeEmLisboa } from "@/lib/formatar"

export const HORAS_NORMAIS_DIA = 8
export const MINUTOS_NORMAIS_DIA = HORAS_NORMAIS_DIA * 60

const MINUTO = 60_000

// ---------------------------------------------------------------------
// Datas e horas em Lisboa
// ---------------------------------------------------------------------

const formatoPartes = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO_HORARIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

/** Diferença (em minutos) entre a hora de Lisboa e UTC nesse instante: 0 no inverno, 60 no verão. */
export function desvioLisboaMinutos(instante: number): number {
  const partes: Record<string, number> = {}
  for (const parte of formatoPartes.formatToParts(new Date(instante))) {
    if (parte.type !== "literal") partes[parte.type] = Number(parte.value)
  }
  const comoUTC = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour % 24, partes.minute, partes.second)
  return Math.round((comoUTC - Math.floor(instante / 1000) * 1000) / MINUTO)
}

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

export function eHoraValida(hora: string | null | undefined): hora is string {
  return !!hora && HORA.test(hora)
}

/**
 * Data (aaaa-mm-dd) + hora (hh:mm) de Lisboa → instante exato.
 * Usa o desvio de Lisboa NESSA data (hora de verão ou de inverno), e não o
 * fuso do servidor. Na noite da mudança de hora: uma hora que não existe
 * (março) avança uma hora; uma hora que se repete (outubro) fica a segunda
 * (já na hora de inverno).
 */
export function instanteLisboa(data: string, hora: string): Date {
  if (!eDataValida(data) || !eHoraValida(hora)) throw new Error(`Data/hora inválida: ${data} ${hora}`)
  const [ano, mes, dia] = data.split("-").map(Number)
  const [horas, minutos] = hora.split(":").map(Number)
  const local = Date.UTC(ano, mes - 1, dia, horas, minutos)
  const primeiro = desvioLisboaMinutos(local)
  let instante = local - primeiro * MINUTO
  const segundo = desvioLisboaMinutos(instante)
  if (segundo !== primeiro) instante = local - segundo * MINUTO
  return new Date(instante)
}

/** Data em Lisboa (aaaa-mm-dd) de um instante. */
export function dataEmLisboa(instante: string | Date | number): string {
  return hojeEmLisboa(new Date(instante))
}

/** Hora em Lisboa (hh:mm) de um instante. */
export function horaEmLisboa(instante: string | Date | number): string {
  const partes: Record<string, string> = {}
  for (const parte of formatoPartes.formatToParts(new Date(instante))) partes[parte.type] = parte.value
  return `${partes.hour}:${partes.minute}`
}

/** Início do dia seguinte (00:00 em Lisboa) — o fim exclusivo do dia. */
export function fimDoDiaLisboa(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number)
  const seguinte = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10)
  return instanteLisboa(seguinte, "00:00")
}

// ---------------------------------------------------------------------
// Meses ("aaaa-mm")
// ---------------------------------------------------------------------

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/

export function eMesValido(mes: string | null | undefined): mes is string {
  return !!mes && MES.test(mes) && Number(mes.slice(0, 4)) >= 2000 && Number(mes.slice(0, 4)) <= 2100
}

export function mesDaData(data: string): string {
  return data.slice(0, 7)
}

export function somarMesesMes(mes: string, meses: number): string {
  const [ano, numero] = mes.split("-").map(Number)
  return new Date(Date.UTC(ano, numero - 1 + meses, 1)).toISOString().slice(0, 7)
}

/** Primeiro e último dia do mês, e os instantes que o delimitam em Lisboa ([desde, ate[). */
export function intervaloDoMes(mes: string) {
  const primeiro = `${mes}-01`
  const ultimo = ultimoDiaDoMes(primeiro)
  return {
    primeiro,
    ultimo,
    dias: diasEntre(primeiro, ultimo),
    desde: instanteLisboa(primeiro, "00:00").toISOString(),
    ate: instanteLisboa(`${somarMesesMes(mes, 1)}-01`, "00:00").toISOString(),
  }
}

// ---------------------------------------------------------------------
// Períodos e dias
// ---------------------------------------------------------------------

export type PeriodoBase = {
  entrada: string
  saida: string | null
  trabalhoId: string | null
  aRever: boolean
}

function aoMinuto(instante: number) {
  return Math.floor(instante / MINUTO) * MINUTO
}

/** Minutos de um período (aberto = até agora, no máximo até ao fim do dia da entrada). */
export function minutosDoPeriodo(periodo: Pick<PeriodoBase, "entrada" | "saida">, agora: Date | number): number {
  const entrada = new Date(periodo.entrada).getTime()
  let fim: number
  if (periodo.saida) {
    fim = new Date(periodo.saida).getTime()
  } else {
    const limite = fimDoDiaLisboa(dataEmLisboa(entrada)).getTime() - 1000
    fim = Math.min(new Date(agora).getTime(), limite)
  }
  return Math.max(0, Math.round((aoMinuto(fim) - aoMinuto(entrada)) / MINUTO))
}

/** Sábados, domingos e feriados nacionais: todas as horas contam como extra. */
export function eDiaDeExtra(data: string): boolean {
  return eFimDeSemana(data) || feriadoNacional(data) !== null
}

/** Divide os minutos de um dia em normais e extra. */
export function dividirMinutosDia(data: string, minutos: number): { normais: number; extra: number } {
  if (eDiaDeExtra(data)) return { normais: 0, extra: minutos }
  const extra = Math.max(0, minutos - MINUTOS_NORMAIS_DIA)
  return { normais: minutos - extra, extra }
}

export type DiaHoras<P extends PeriodoBase = PeriodoBase> = {
  data: string
  periodos: (P & { minutos: number })[]
  minutos: number
  normais: number
  extra: number
  fimDeSemana: boolean
  feriado: string | null
  aRever: boolean
  emCurso: boolean
}

/** Agrupa os períodos pelo dia da entrada (Lisboa), por ordem, com os totais de cada dia. */
export function agruparPorDia<P extends PeriodoBase>(periodos: P[], agora: Date | number): DiaHoras<P>[] {
  const porDia = new Map<string, (P & { minutos: number })[]>()
  const ordenados = [...periodos].sort((a, b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime())
  for (const periodo of ordenados) {
    const data = dataEmLisboa(periodo.entrada)
    const lista = porDia.get(data) ?? []
    lista.push({ ...periodo, minutos: minutosDoPeriodo(periodo, agora) })
    porDia.set(data, lista)
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, lista]) => {
      const minutos = lista.reduce((soma, periodo) => soma + periodo.minutos, 0)
      return {
        data,
        periodos: lista,
        minutos,
        ...dividirMinutosDia(data, minutos),
        fimDeSemana: eFimDeSemana(data),
        feriado: feriadoNacional(data),
        aRever: lista.some((periodo) => periodo.aRever),
        emCurso: lista.some((periodo) => periodo.saida === null),
      }
    })
}

export type TotaisMes = {
  /** Todos os minutos trabalhados. */
  minutos: number
  normais: number
  /** Extra em dias úteis (acima de 8 h). */
  extraUteis: number
  /** Extra em fins de semana e feriados (todas as horas desses dias). */
  extraFimDeSemana: number
  /** Dias com horas registadas. */
  dias: number
}

export function totaisDoMes(dias: Pick<DiaHoras, "data" | "minutos" | "normais" | "extra">[]): TotaisMes {
  const totais: TotaisMes = { minutos: 0, normais: 0, extraUteis: 0, extraFimDeSemana: 0, dias: 0 }
  for (const dia of dias) {
    totais.minutos += dia.minutos
    totais.normais += dia.normais
    if (eDiaDeExtra(dia.data)) totais.extraFimDeSemana += dia.extra
    else totais.extraUteis += dia.extra
    if (dia.minutos > 0) totais.dias += 1
  }
  return totais
}

export type HorasDeTrabalho<P extends PeriodoBase> = {
  /** null = períodos sem trabalho (armazém, deslocação…). */
  trabalhoId: string | null
  minutos: number
  /** Primeiro período desse trabalho (para ler o título, o cliente, a data). */
  exemplo: P
}

/** Soma dos minutos por trabalho, do maior para o menor ("Sem trabalho" no fim). */
export function horasPorTrabalho<P extends PeriodoBase>(periodos: P[], agora: Date | number): HorasDeTrabalho<P>[] {
  const grupos = new Map<string | null, HorasDeTrabalho<P>>()
  for (const periodo of periodos) {
    const grupo = grupos.get(periodo.trabalhoId)
    const minutos = minutosDoPeriodo(periodo, agora)
    if (grupo) grupo.minutos += minutos
    else grupos.set(periodo.trabalhoId, { trabalhoId: periodo.trabalhoId, minutos, exemplo: periodo })
  }
  return [...grupos.values()].sort((a, b) => {
    if ((a.trabalhoId === null) !== (b.trabalhoId === null)) return a.trabalhoId === null ? 1 : -1
    return b.minutos - a.minutos
  })
}

/** Texto para nomes de ficheiro: "Inês Rocha" → "ines-rocha". */
export function semAcentosParaFicheiro(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "colaborador"
  )
}
