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

// Quantos treinos um plano "dá direito a" entre duas datas — usado em
// Pagamentos para comparar com os treinos realmente realizados no
// período pago, em vez do mês de calendário (ver treinosPrevistos).
export function treinosNoPeriodo(porSemana: number | null, inicioISO: string, fimISO: string): number | null {
  if (!porSemana) return null
  const inicio = new Date(`${inicioISO}T00:00:00`)
  const fim = new Date(`${fimISO}T00:00:00`)
  const dias = Math.max(0, (fim.getTime() - inicio.getTime()) / 86400000)
  return Math.round(porSemana * (dias / 7))
}

export function intervaloMes(ano: number, mes: number): { inicio: string; fimExclusivo: string } {
  const proxAno = mes === 12 ? ano + 1 : ano
  const proxMes = mes === 12 ? 1 : mes + 1
  return {
    inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
    fimExclusivo: `${proxAno}-${String(proxMes).padStart(2, '0')}-01`,
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

const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_ABREVIADOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Um período escrito de forma curta, para as barras de cada ecrã:
// "23 – 29 nov 2026" · "30 nov – 6 dez 2026" · "28 dez – 3 jan 2027".
// (Entre anos leva só o ano do fim: assim nunca passa de 19 letras e a
// barra pode reservar-lhe uma largura fixa.)
export function intervaloCurto(inicio: string, fim: string): string {
  const [a1, m1, d1] = inicio.split('-').map(Number)
  const [a2, m2, d2] = fim.split('-').map(Number)
  if (a1 !== a2 || m1 !== m2) return `${d1} ${MESES_ABREVIADOS[m1 - 1]} – ${d2} ${MESES_ABREVIADOS[m2 - 1]} ${a2}`
  return `${d1} – ${d2} ${MESES_ABREVIADOS[m2 - 1]} ${a2}`
}

// Um dia escrito de forma curta, com o dia da semana: "qua, 25 nov 2026".
export function diaCurto(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const semana = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return `${DIAS_ABREVIADOS[semana]}, ${d} ${MESES_ABREVIADOS[m - 1]} ${a}`
}

// O mesmo, sem o ano ("qui, 27 nov") — para listas de dias próximos.
export function diaSemAno(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const semana = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return `${DIAS_ABREVIADOS[semana]}, ${d} ${MESES_ABREVIADOS[m - 1]}`
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeiras = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : [partes[0]]
  return primeiras.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function diasDoMes(ano: number, mes: number): string[] {
  const total = new Date(ano, mes, 0).getDate()
  return Array.from(
    { length: total },
    (_, i) => `${ano}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  )
}

// Semana a começar à segunda-feira: 0 = Seg … 6 = Dom.
export function offsetPrimeiroDia(ano: number, mes: number): number {
  const diaSemana = new Date(ano, mes - 1, 1).getDay()
  return (diaSemana + 6) % 7
}

export type DesmarcacaoPorCliente = {
  clienteId: string
  total: number
  remarcadas: number
  naoRemarcadas: number
}

// Agrupa as ocorrências canceladas da agenda por cliente, para a
// página de Presenças conseguir mostrar, por pessoa, quantas vezes
// desmarcou este mês e quantas dessas já foram remarcadas para outro
// dia — só entram clientes com pelo menos uma desmarcação.
export function agruparDesmarcacoesPorCliente(
  eventosCancelados: { cliente_id: string | null; foi_remarcado: boolean }[]
): DesmarcacaoPorCliente[] {
  const porCliente = new Map<string, { remarcadas: number; naoRemarcadas: number }>()
  for (const e of eventosCancelados) {
    if (!e.cliente_id) continue
    const atual = porCliente.get(e.cliente_id) ?? { remarcadas: 0, naoRemarcadas: 0 }
    if (e.foi_remarcado) atual.remarcadas++
    else atual.naoRemarcadas++
    porCliente.set(e.cliente_id, atual)
  }
  return Array.from(porCliente.entries()).map(([clienteId, { remarcadas, naoRemarcadas }]) => ({
    clienteId,
    total: remarcadas + naoRemarcadas,
    remarcadas,
    naoRemarcadas,
  }))
}
