// Datas e horas sempre no fuso de Portugal continental.
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function hojeLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(agora)
}

export function horaLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora)
}

const meioDia = (dia: string) => new Date(`${dia}T12:00:00Z`)

export function somarDias(dia: string, n: number): string {
  const d = meioDia(dia)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// "Hoje" · "Amanhã" · "quarta, 25 nov"
export function diaPorExtenso(dia: string, hoje: string): string {
  if (dia === hoje) return 'Hoje'
  if (dia === somarDias(hoje, 1)) return 'Amanhã'
  const d = meioDia(dia)
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}

// Título de um dia numa lista: "Hoje · 22 nov" · "Amanhã · 23 nov" · "Quarta · 25 nov"
export function tituloDia(dia: string, hoje: string): string {
  const d = meioDia(dia)
  const data = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
  if (dia === hoje) return `Hoje · ${data}`
  if (dia === somarDias(hoje, 1)) return `Amanhã · ${data}`
  const nome = DIAS[d.getUTCDay()]
  return `${nome[0].toUpperCase()}${nome.slice(1)} · ${data}`
}

// "domingo, 22 de novembro"
export function diaLongo(dia: string): string {
  const d = meioDia(dia)
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES_LONGOS[d.getUTCMonth()]}`
}

export function diaSemanaCurto(dia: string): string {
  return DIAS_CURTOS[meioDia(dia).getUTCDay()]
}

export function diaDoMes(dia: string): number {
  return meioDia(dia).getUTCDate()
}

// "20 nov" (com o ano se não for o corrente: "20 nov 2025")
export function dataCurta(dia: string, hoje?: string): string {
  const d = meioDia(dia)
  const ano = hoje && hoje.slice(0, 4) === dia.slice(0, 4) ? '' : ` ${d.getUTCFullYear()}`
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}${ano}`
}

// "novembro 2026"
export function nomeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES_LONGOS[m - 1]} ${a}`
}

// Momento em linguagem corrente: "hoje às 19:00" · "amanhã às 19:00" · "qua, 25 nov às 19:00"
export function quandoAbre(iso: string, agora: Date = new Date()): string {
  const quando = new Date(iso)
  const dia = hojeLisboa(quando)
  const hoje = hojeLisboa(agora)
  const hora = horaLisboa(quando)
  if (dia === hoje) return `hoje às ${hora}`
  if (dia === somarDias(hoje, 1)) return `amanhã às ${hora}`
  const d = meioDia(dia)
  return `${DIAS_CURTOS[d.getUTCDay()]}, ${d.getUTCDate()} ${MESES[d.getUTCMonth()]} às ${hora}`
}

export function jaPassou(dia: string, hora: string, agora: Date = new Date()): boolean {
  const h = hojeLisboa(agora)
  return dia < h || (dia === h && hora.slice(0, 5) <= horaLisboa(agora))
}

export function instanteAtual(): Date {
  return new Date()
}
