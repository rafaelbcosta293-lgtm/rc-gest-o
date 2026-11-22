// Converte um dia + hora "de parede" em Lisboa no instante exato (UTC),
// respeitando a hora de verão. Função pura.
function desvioLisboaMin(d: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Lisbon',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d)
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value)
  const local = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'))
  return Math.round((local - Math.floor(d.getTime() / 60000) * 60000) / 60000)
}

export function instanteLisboa(data: string, hora: string): Date {
  const [a, m, d] = data.split('-').map(Number)
  const [h, mi] = hora.split(':').map(Number)
  const comoUtc = Date.UTC(a, m - 1, d, h, mi)
  let t = comoUtc - desvioLisboaMin(new Date(comoUtc)) * 60000
  const corrigido = desvioLisboaMin(new Date(t))
  t = comoUtc - corrigido * 60000
  return new Date(t)
}

export function somarDiasIso(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
