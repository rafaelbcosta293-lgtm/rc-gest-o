export function treinosPrevistos(
  frequenciaSemanal: number | null,
  ano: number,
  mes: number
): { exato: number; arredondado: number; semanas: number } | null {
  if (!frequenciaSemanal) return null
  const dias = new Date(ano, mes, 0).getDate()
  const semanas = dias / 7
  return {
    exato: frequenciaSemanal * semanas,
    arredondado: Math.round(frequenciaSemanal * semanas),
    semanas,
  }
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function fmt(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
