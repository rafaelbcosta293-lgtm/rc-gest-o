/**
 * Datas sem hora no formato da base de dados ("aaaa-mm-dd"), sempre
 * calculadas em UTC para não haver saltos com a mudança de hora.
 */

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/

function paraUTC(data: string): Date {
  const partes = DATA.exec(data)
  if (!partes) throw new Error(`Data inválida: ${data}`)
  return new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])))
}

function deUTC(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function eDataValida(data: string | null | undefined): data is string {
  if (!data || !DATA.test(data)) return false
  return deUTC(paraUTC(data)) === data
}

export function somarDiasData(data: string, dias: number): string {
  const resultado = paraUTC(data)
  resultado.setUTCDate(resultado.getUTCDate() + dias)
  return deUTC(resultado)
}

/** 1 = segunda … 7 = domingo. */
export function diaDaSemana(data: string): number {
  const dia = paraUTC(data).getUTCDay()
  return dia === 0 ? 7 : dia
}

export function eFimDeSemana(data: string): boolean {
  return diaDaSemana(data) >= 6
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(data: string): string {
  return somarDiasData(data, 1 - diaDaSemana(data))
}

/** Lista de datas de inicio a fim (inclusive). */
export function diasEntre(inicio: string, fim: string): string[] {
  const dias: string[] = []
  for (let dia = inicio; dia <= fim; dia = somarDiasData(dia, 1)) dias.push(dia)
  return dias
}

export function primeiroDiaDoMes(data: string): string {
  return `${data.slice(0, 7)}-01`
}

export function ultimoDiaDoMes(data: string): string {
  const [ano, mes] = data.split("-").map(Number)
  return deUTC(new Date(Date.UTC(ano, mes, 0)))
}

/** Soma meses mantendo o dia (ou o último dia, se o mês for mais curto). */
export function somarMeses(data: string, meses: number): string {
  const [ano, mes, dia] = data.split("-").map(Number)
  const ultimo = new Date(Date.UTC(ano, mes - 1 + meses + 1, 0)).getUTCDate()
  return deUTC(new Date(Date.UTC(ano, mes - 1 + meses, Math.min(dia, ultimo))))
}

const formatoDiaCurto = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" })
const formatoDiaLongo = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
const formatoMesAno = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", month: "long", year: "numeric" })
const formatoDiaSemanaCurto = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", weekday: "short" })

/** Ex.: "terça, 13/10". */
export function formatarDiaCurto(data: string): string {
  return formatoDiaCurto.format(paraUTC(data))
}

/** Ex.: "segunda-feira, 13 de outubro". */
export function formatarDiaLongo(data: string): string {
  return formatoDiaLongo.format(paraUTC(data))
}

/** Ex.: "outubro de 2026". */
export function formatarMesAno(data: string): string {
  return formatoMesAno.format(paraUTC(data))
}

/** Ex.: "terça". */
export function formatarDiaSemanaCurto(data: string): string {
  return formatoDiaSemanaCurto.format(paraUTC(data))
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return deUTC(new Date(Date.UTC(ano, mes - 1, dia)))
}

/** Feriados nacionais obrigatórios em Portugal (sem feriados municipais nem Carnaval). */
export function feriadosNacionais(ano: number): Map<string, string> {
  const p = pascoa(ano)
  const fixos: [string, string][] = [
    ["01-01", "Ano Novo"],
    ["04-25", "Dia da Liberdade"],
    ["05-01", "Dia do Trabalhador"],
    ["06-10", "Dia de Portugal"],
    ["08-15", "Assunção de Nossa Senhora"],
    ["10-05", "Implantação da República"],
    ["11-01", "Todos os Santos"],
    ["12-01", "Restauração da Independência"],
    ["12-08", "Imaculada Conceição"],
    ["12-25", "Natal"],
  ]
  const feriados = new Map<string, string>(fixos.map(([md, nome]) => [`${ano}-${md}`, nome]))
  feriados.set(somarDiasData(p, -2), "Sexta-feira Santa")
  feriados.set(p, "Páscoa")
  feriados.set(somarDiasData(p, 60), "Corpo de Deus")
  return feriados
}

/** Nome do feriado nacional nessa data, ou null. */
export function feriadoNacional(data: string): string | null {
  return feriadosNacionais(Number(data.slice(0, 4))).get(data) ?? null
}
