import type { EstadoCliente } from '@/lib/supabase/database.types'

// Regras de transição automática de estado por falta de pagamento:
// 1 mês sem mensalidade ativa -> Suspenso, 2 meses ou mais -> Ex-cliente.
// Nunca volta a Ativo sozinho — isso só acontece ao registar um
// pagamento (ver criarPagamento em app/painel/[estudio]/pagamentos/actions.ts)
// ou à mão, na ficha do cliente.
export const DIAS_PARA_SUSPENSO = 30
export const DIAS_PARA_EXCLIENTE = 60

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

// Devolve o novo estado a gravar, ou null se nada deve mudar. A única
// exceção às regras acima é o estado ter sido alterado manualmente
// (estadoAutomatico=false) — nesse caso este cliente nunca é tocado.
export function calcularTransicaoAutomatica(
  cliente: ClienteParaEstadoAutomatico,
  hojeISO: string
): EstadoCliente | null {
  if (!cliente.estadoAutomatico) return null
  if (cliente.estado === 'Ex-cliente') return null

  // Sem nenhum pagamento registado, não há base nenhuma para avaliar —
  // fica de fora (em vez de ser suspenso às cegas, por exemplo pela
  // data de início de contrato de clientes antigos cujo histórico de
  // pagamentos nunca foi registado na app).
  if (!cliente.validoAte) return null

  const dias = diasEntre(cliente.validoAte, hojeISO)
  if (dias >= DIAS_PARA_EXCLIENTE) return 'Ex-cliente'
  if (dias >= DIAS_PARA_SUSPENSO) return cliente.estado === 'Suspenso' ? null : 'Suspenso'
  return null
}
