// Feriados obrigatórios nacionais em Portugal — os estúdios não
// trabalham nestes dias. Não inclui feriados municipais (cada
// concelho tem o seu, à parte destes).

export type Feriado = { data: string; nome: string }

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function paraISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad2(mes)}-${pad2(dia)}`
}

function somarDiasISO(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Domingo de Páscoa — algoritmo de Meeus/Jones/Butcher (calendário gregoriano).
export function domingoDePascoa(ano: number): string {
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
  return paraISO(ano, mes, dia)
}

// Os 13 feriados obrigatórios do ano — fixos e móveis (ligados à Páscoa).
export function feriadosObrigatorios(ano: number): Feriado[] {
  const pascoa = domingoDePascoa(ano)
  return [
    { data: paraISO(ano, 1, 1), nome: 'Ano Novo' },
    { data: somarDiasISO(pascoa, -2), nome: 'Sexta-feira Santa' },
    { data: pascoa, nome: 'Páscoa' },
    { data: paraISO(ano, 4, 25), nome: 'Dia da Liberdade' },
    { data: paraISO(ano, 5, 1), nome: 'Dia do Trabalhador' },
    { data: somarDiasISO(pascoa, 60), nome: 'Corpo de Deus' },
    { data: paraISO(ano, 6, 10), nome: 'Dia de Portugal' },
    { data: paraISO(ano, 8, 15), nome: 'Assunção de Nossa Senhora' },
    { data: paraISO(ano, 10, 5), nome: 'Implantação da República' },
    { data: paraISO(ano, 11, 1), nome: 'Todos os Santos' },
    { data: paraISO(ano, 12, 1), nome: 'Restauração da Independência' },
    { data: paraISO(ano, 12, 8), nome: 'Imaculada Conceição' },
    { data: paraISO(ano, 12, 25), nome: 'Natal' },
  ].sort((x, y) => x.data.localeCompare(y.data))
}

export function feriadoDoDia(dataISO: string): Feriado | null {
  const ano = Number(dataISO.slice(0, 4))
  return feriadosObrigatorios(ano).find((f) => f.data === dataISO) ?? null
}

// Feriados obrigatórios dentro de [inicio, fimExclusivo) — cobre a
// virada do ano (ex.: semana ou mês a cavalo entre dezembro e janeiro).
export function feriadosNoIntervalo(inicio: string, fimExclusivo: string): Feriado[] {
  const anoInicio = Number(inicio.slice(0, 4))
  const anoFim = Number(fimExclusivo.slice(0, 4))
  const anos = anoFim > anoInicio ? [anoInicio, anoFim] : [anoInicio]
  const todos = anos.flatMap(feriadosObrigatorios)
  return todos.filter((f) => f.data >= inicio && f.data < fimExclusivo)
}
