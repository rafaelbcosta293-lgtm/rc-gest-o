import type { Aula, Pedido } from './dados'
import { quandoAbre } from './datas'

// O que mostrar em cada aula (função pura, testada).
export type VistaAula =
  | { acao: 'reservar' }
  | { acao: 'cancelar' }
  | { acao: 'nenhuma'; texto: string; tom: 'neutro' | 'ok' | 'aviso' }
  | { acao: 'em_curso' }

export function vistaAula(aula: Aula, inscrito: boolean, pedido: Pedido | undefined, agora: Date): VistaAula {
  if (pedido && (pedido.estado === 'pendente' || pedido.estado === 'em_analise')) return { acao: 'em_curso' }
  if (aula.estado !== 'Aberta') return { acao: 'nenhuma', texto: 'Aula cancelada', tom: 'aviso' }
  const t = agora.getTime()
  const cancelarAte = aula.cancelar_ate ? new Date(aula.cancelar_ate).getTime() : null
  // cancelar_ate = início − 2 h
  if (cancelarAte != null && t >= cancelarAte + 2 * 3600_000) {
    return { acao: 'nenhuma', texto: inscrito ? 'Inscrito' : 'Já começou', tom: inscrito ? 'ok' : 'neutro' }
  }
  if (inscrito) {
    if (cancelarAte != null && t > cancelarAte) return { acao: 'nenhuma', texto: 'Está inscrito', tom: 'ok' }
    return { acao: 'cancelar' }
  }
  if (aula.reserva_abre_em && t < new Date(aula.reserva_abre_em).getTime()) {
    return { acao: 'nenhuma', texto: `Reservas abrem ${quandoAbre(aula.reserva_abre_em)}`, tom: 'neutro' }
  }
  if (aula.ocupadas >= aula.lotacao) return { acao: 'nenhuma', texto: 'Aula cheia', tom: 'aviso' }
  return { acao: 'reservar' }
}

export function vagas(aula: Aula): string {
  const livres = Math.max(0, aula.lotacao - aula.ocupadas)
  if (livres === 0) return 'Sem vagas'
  return livres === 1 ? '1 vaga' : `${livres} vagas`
}

// Último pedido de cada alvo (o mais recente primeiro na lista).
export function ultimoPedidoPorAlvo(pedidos: Pedido[]): Map<string, Pedido> {
  const m = new Map<string, Pedido>()
  for (const p of pedidos) if (!m.has(p.alvo)) m.set(p.alvo, p)
  return m
}

// Presenças por mês (últimos meses primeiro).
export function presencasPorMes(presencas: { data: string; estado: string }[]): { mes: string; presentes: number; faltas: number }[] {
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
