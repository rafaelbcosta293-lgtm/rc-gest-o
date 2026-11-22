// Datas e horas sempre no fuso de Portugal continental.
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function hojeLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(agora)
}

export function horaLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora)
}

// "segunda, 1 dez" · com "Hoje" / "Amanhã"
export function diaPorExtenso(dia: string, hoje: string): string {
  if (dia === hoje) return 'Hoje'
  const amanha = new Date(`${hoje}T12:00:00Z`)
  amanha.setUTCDate(amanha.getUTCDate() + 1)
  if (dia === amanha.toISOString().slice(0, 10)) return 'Amanhã'
  const d = new Date(`${dia}T12:00:00Z`)
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}

export function dataCurta(dia: string): string {
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a}`
}

export function nomeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

// "dd/mm às hh:mm" de um instante ISO.
export function quandoAbre(iso: string): string {
  const f = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return f.format(new Date(iso)).replace(',', ' às')
}

export function jaPassou(dia: string, hora: string, agora: Date = new Date()): boolean {
  const h = hojeLisboa(agora)
  return dia < h || (dia === h && hora.slice(0, 5) <= horaLisboa(agora))
}

export function instanteAtual(): Date {
  return new Date()
}
