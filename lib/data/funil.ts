// Métricas do funil de leads (secção 4 da especificação), calculadas a
// partir do histórico de etapas ("lead_stage_history", gravado só por
// trigger — nunca escrito pela app). Tudo em JS puro sobre os dados já
// carregados: a escala (algumas centenas de leads por estúdio) não
// justifica uma função SQL dedicada, ao contrário dos resumos diários
// já existentes (quadro_do_dia, resumo_mensal_pt).

export type HistoricoEtapaLinha = {
  lead_id: string
  estado_anterior: string | null
  estado_novo: string
  criado_em: string
}

export type MetricasFunil = {
  total: number
  porEtapa: Record<string, number>
  taxaConversao: number
  horasMediasPrimeiroContacto: number | null
  taxaComparecimento: number | null
}

export function calcularMetricasFunil(
  leadIds: string[],
  historico: HistoricoEtapaLinha[],
  ordemEtapas: readonly string[]
): MetricasFunil {
  const noEscopo = new Set(leadIds)
  const porLead = new Map<string, HistoricoEtapaLinha[]>()
  for (const linha of historico) {
    if (!noEscopo.has(linha.lead_id)) continue
    const lista = porLead.get(linha.lead_id) ?? []
    lista.push(linha)
    porLead.set(linha.lead_id, lista)
  }

  const porEtapa: Record<string, number> = {}
  for (const etapa of ordemEtapas) porEtapa[etapa] = 0

  let somaHoras = 0
  let contagemHoras = 0
  let agendadasOuFalhadas = 0
  let realizadas = 0

  for (const linhas of porLead.values()) {
    const ordenadas = [...linhas].sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1))
    const etapasAlcancadas = new Set(ordenadas.map((l) => l.estado_novo))
    for (const etapa of ordemEtapas) {
      if (etapasAlcancadas.has(etapa)) porEtapa[etapa] += 1
    }

    const criacao = ordenadas[0]
    const primeiraSaidaDeNova = ordenadas.find((l) => l.estado_anterior === 'Nova')
    if (criacao && primeiraSaidaDeNova) {
      const horas =
        (new Date(primeiraSaidaDeNova.criado_em).getTime() - new Date(criacao.criado_em).getTime()) /
        3_600_000
      if (horas >= 0) {
        somaHoras += horas
        contagemHoras += 1
      }
    }

    const teveExperimental =
      etapasAlcancadas.has('Experimental agendada') ||
      etapasAlcancadas.has('Falhou a experimental') ||
      etapasAlcancadas.has('Experimental realizada')
    if (teveExperimental) {
      agendadasOuFalhadas += 1
      if (etapasAlcancadas.has('Experimental realizada')) realizadas += 1
    }
  }

  const total = leadIds.length
  return {
    total,
    porEtapa,
    taxaConversao: total > 0 ? (porEtapa['Ganha'] ?? 0) / total : 0,
    horasMediasPrimeiroContacto: contagemHoras > 0 ? somaHoras / contagemHoras : null,
    taxaComparecimento: agendadasOuFalhadas > 0 ? realizadas / agendadasOuFalhadas : null,
  }
}
