import { instanteLisboa } from './tempo'

// Pedidos que chegam da app do cliente. A app só PEDE; quem decide é a
// gestão, com as regras daqui.

export type PedidoApp = {
  id: string
  conta_id: string
  tipo: 'inscrever_aula' | 'cancelar_aula' | 'desmarcar_treino'
  alvo: string
  nota: string | null
  criado_em: string
}

export type RespostaPedido = { id: string; estado: 'em_analise' | 'aceite' | 'recusado'; resposta: string }

export const RESPOSTAS = {
  inscrito: 'Inscrição confirmada.',
  cancelado: 'Inscrição cancelada.',
  emAnalise: 'Pedido enviado à equipa. A resposta aparece aqui.',
  desmarcado: 'O treino foi desmarcado.',
  semConta: 'A sua conta não tem acesso. Fale com a equipa do estúdio.',
  foraDeTempo: 'O pedido não foi tratado a tempo. Fale com a equipa do estúdio.',
} as const

export type EventoParaDesmarcar = {
  id: string
  cliente_id: string | null
  tipo: string
  estado: string
  data: string
  hora_inicio: string
}

// Pedido de desmarcação de um treino: só se for do próprio cliente,
// ainda agendado e no futuro. A desmarcação em si é feita pela equipa
// (na Agenda), que decide se conta ou não como realizado.
export function avaliarDesmarcacao(evento: EventoParaDesmarcar | null, clienteId: string, agora: Date): string | null {
  if (!evento || evento.cliente_id !== clienteId || !['Treino', 'Avaliação'].includes(evento.tipo)) return 'Treino não encontrado.'
  if (evento.estado === 'Cancelado') return 'Este treino já está desmarcado.'
  if (evento.estado !== 'Agendado') return 'Este treino já não pode ser desmarcado.'
  if (instanteLisboa(evento.data, evento.hora_inicio) <= agora) return 'Este treino já começou. Fale com a equipa do estúdio.'
  return null
}

// Pedido de desmarcação ainda em análise: fecha-se sozinho quando a
// equipa desmarca o treino na Agenda, ou quando o treino já passou.
export function fecharDesmarcacao(evento: EventoParaDesmarcar | null, agora: Date): RespostaPedido['estado'] | null {
  if (!evento || evento.estado === 'Cancelado') return 'aceite'
  if (instanteLisboa(evento.data, evento.hora_inicio) <= agora) return 'recusado'
  return null
}

// Erro levantado pelas funções da base de dados (raise exception) — a
// mensagem é para o cliente. Outros erros (rede, etc.) ficam para a
// próxima volta.
export function erroDeRegra(error: { code?: string; message: string } | null): string | null {
  if (!error) return null
  return error.code === 'P0001' ? error.message : null
}
