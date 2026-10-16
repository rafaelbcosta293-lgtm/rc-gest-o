import { DIAS_AVISO, type AlertaPrazo, type EstadoEquipamento } from "@/lib/recursos"

/** Avariado ou em reparação também conta como alerta (além dos prazos). */
export function temAlerta(estado: EstadoEquipamento, alertas: AlertaPrazo[]) {
  return alertas.length > 0 || estado === "avariado" || estado === "em_reparacao"
}

/**
 * Urgência (menor = mais urgente), a ordem de /recursos?filtro=alertas e do
 * cartão do Início: prazos vencidos primeiro (os mais antigos à frente),
 * depois avariados (como um prazo que vence hoje), os prazos a vencer e, no
 * fim, os que já estão em reparação.
 */
export function urgenciaEquipamento(estado: EstadoEquipamento, alertas: AlertaPrazo[]) {
  const valores = alertas.map((alerta) => alerta.dias)
  if (estado === "avariado") valores.push(0)
  if (estado === "em_reparacao") valores.push(DIAS_AVISO + 1)
  return Math.min(...valores)
}
