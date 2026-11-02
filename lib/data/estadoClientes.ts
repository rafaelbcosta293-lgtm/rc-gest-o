import type { EstadoCliente } from '@/lib/supabase/database.types'

// Regras de transição automática de estado por pagamento: "Ativo" só
// vale enquanto o pagamento está em dia — qualquer atraso tira logo o
// cliente desse estado (Pendente); a partir de 2 meses (60 dias) sem
// pagar passa a Inativo. Nunca volta a Ativo sozinho — isso só
// acontece ao registar um pagamento (ver criarPagamento em
// app/painel/[estudio]/pagamentos/actions.ts) ou à mão, na ficha do
// cliente. Nenhum destes estados afeta agendamentos ou o envio de
// mensagens, que continuam a valer para qualquer cliente.
//
// "Suspenso" não entra nestas regras: é só para casos específicos
// (saúde ou outras), sempre atribuído e removido à mão.
export const DIAS_PARA_INATIVO = 60

export type ClienteParaEstadoAutomatico = {
  id: string
  estado: EstadoCliente
  estadoAutomatico: boolean
  validoAte: string | null
}

function diasEntre(deISO: string, paraISO: string): number {
  return Math.round(
    (new Date(`${paraISO}T00:00:00Z`).getTime() - new Date(`${deISO}T00:00:00Z`).getTime()) / 86_400_000
  )
}

// Devolve o novo estado a gravar, ou null se nada deve mudar. Nunca
// toca em quem está Suspenso ou Inativo (saída desses dois é sempre
// manual ou via pagamento, nunca por aqui) nem em quem teve o estado
// alterado manualmente (estadoAutomatico=false).
export function calcularTransicaoAutomatica(
  cliente: ClienteParaEstadoAutomatico,
  hojeISO: string
): EstadoCliente | null {
  if (!cliente.estadoAutomatico) return null
  if (cliente.estado === 'Suspenso') return null
  if (cliente.estado === 'Inativo') return null

  // Sem nenhum pagamento registado (ex.: cliente antigo cujo histórico
  // nunca foi lançado na app) também conta como "sem pagamento em
  // dia" — vai para Pendente tal como quem tem um pagamento expirado.
  // Não há data nenhuma para calcular há quanto tempo está em
  // atraso, por isso não avança sozinho para Inativo: fica em
  // Pendente até alguém registar um pagamento ou decidir à mão.
  if (!cliente.validoAte) {
    return cliente.estado === 'Pendente' ? null : 'Pendente'
  }

  const dias = diasEntre(cliente.validoAte, hojeISO)
  if (dias >= DIAS_PARA_INATIVO) return 'Inativo'
  if (dias >= 1) return cliente.estado === 'Pendente' ? null : 'Pendente'
  return null
}
