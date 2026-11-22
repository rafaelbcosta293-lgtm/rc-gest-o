import type { Aula, Pedido } from './dados'

// O que mostrar em cada aula (função pura, testada).
export type EstadoAula =
  | { tipo: 'reservar' }
  | { tipo: 'cancelar' } // inscrito, ainda a tempo de cancelar
  | { tipo: 'inscrito' } // inscrito, já fora do prazo de cancelamento
  | { tipo: 'em_curso' } // pedido à espera de resposta
  | { tipo: 'cheia' }
  | { tipo: 'por_abrir'; abre: string }
  | { tipo: 'cancelada' }
  | { tipo: 'terminada' } // já começou

const HORAS_CANCELAR = 2

export function estadoAula(aula: Aula, inscrito: boolean, pedido: Pedido | undefined, agora: Date): EstadoAula {
  if (pedido && (pedido.estado === 'pendente' || pedido.estado === 'em_analise')) return { tipo: 'em_curso' }
  if (aula.estado !== 'Aberta') return { tipo: 'cancelada' }
  const t = agora.getTime()
  const cancelarAte = aula.cancelar_ate ? new Date(aula.cancelar_ate).getTime() : null
  // cancelar_ate = início − 2 h
  if (cancelarAte != null && t >= cancelarAte + HORAS_CANCELAR * 3600_000) return inscrito ? { tipo: 'inscrito' } : { tipo: 'terminada' }
  if (inscrito) return cancelarAte != null && t > cancelarAte ? { tipo: 'inscrito' } : { tipo: 'cancelar' }
  if (aula.reserva_abre_em && t < new Date(aula.reserva_abre_em).getTime()) return { tipo: 'por_abrir', abre: aula.reserva_abre_em }
  if (aula.ocupadas >= aula.lotacao) return { tipo: 'cheia' }
  return { tipo: 'reservar' }
}

export function vagas(aula: Aula): string {
  const livres = Math.max(0, aula.lotacao - aula.ocupadas)
  if (livres === 0) return 'Sem vagas'
  return livres === 1 ? 'Última vaga' : `${livres} vagas`
}

// Último pedido de cada alvo (a lista vem do mais recente para o mais antigo).
export function ultimoPedidoPorAlvo(pedidos: Pedido[]): Map<string, Pedido> {
  const m = new Map<string, Pedido>()
  for (const p of pedidos) if (!m.has(p.alvo)) m.set(p.alvo, p)
  return m
}

export type MesPresencas = { mes: string; presentes: number; faltas: number }

// Presenças por mês (mês mais recente primeiro).
export function presencasPorMes(presencas: { data: string; estado: string }[]): MesPresencas[] {
  const m = new Map<string, { presentes: number; faltas: number }>()
  for (const p of presencas) {
    const mes = p.data.slice(0, 7)
    const v = m.get(mes) ?? { presentes: 0, faltas: 0 }
    if (p.estado === 'Presente') v.presentes++
    else if (p.estado.startsWith('Faltou')) v.faltas++
    m.set(mes, v)
  }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([mes, v]) => ({ mes, ...v }))
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

// Variação entre duas medições, arredondada a uma casa (null se faltar alguma).
export function variacao(de: number | null, para: number | null): number | null {
  if (de == null || para == null) return null
  return Math.round((Number(para) - Number(de)) * 10) / 10
}
