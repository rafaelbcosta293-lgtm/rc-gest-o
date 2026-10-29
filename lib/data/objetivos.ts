// Objetivos e calculadora de funil inverso (secção 6.1). JS puro,
// mesma abordagem dos outros painéis.

export type Semaforo = 'verde' | 'ambar' | 'vermelho'

export function semaforoPorRatio(ratio: number): Semaforo {
  if (ratio >= 1) return 'verde'
  if (ratio >= 0.9) return 'ambar'
  return 'vermelho'
}

export type ProgressoFluxo = {
  tipo: 'fluxo'
  atual: number
  meta: number
  projecaoFimDoMes: number
  ritmoDiarioNecessario: number | null
  semaforo: Semaforo
}

// Métricas que são um fluxo dentro do mês (leads, vendas, novos
// clientes): o progresso de hoje é extrapolado linearmente até ao fim
// do mês (sem sazonalidade — é só um ritmo simples), e o ritmo diário
// necessário é quanto falta a dividir pelos dias que restam.
export function progressoFluxo(
  atual: number,
  meta: number,
  diaDoMes: number,
  diasDoMes: number
): ProgressoFluxo {
  const projecaoFimDoMes = diaDoMes > 0 ? (atual / diaDoMes) * diasDoMes : atual
  const diasRestantes = diasDoMes - diaDoMes
  const falta = Math.max(0, meta - atual)
  const ritmoDiarioNecessario = diasRestantes > 0 ? falta / diasRestantes : falta > 0 ? null : 0
  const ratio = meta > 0 ? projecaoFimDoMes / meta : 1
  return { tipo: 'fluxo', atual, meta, projecaoFimDoMes, ritmoDiarioNecessario, semaforo: semaforoPorRatio(ratio) }
}

export type ProgressoStock = { tipo: 'stock'; atual: number; meta: number; semaforo: Semaforo }

// Métricas que são uma fotografia (clientes ativos, MRR, churn, show
// rate, ocupação): comparação direta, sem extrapolação dentro do mês.
export function progressoStock(atual: number, meta: number): ProgressoStock {
  const ratio = meta > 0 ? atual / meta : 1
  return { tipo: 'stock', atual, meta, semaforo: semaforoPorRatio(ratio) }
}

export type FunilInverso = {
  leadsNecessarias: number | null
  experimentaisNecessarias: number | null
  contactosNecessarios: number | null
}

// "Quero X clientes novos por mês" — usa as taxas reais do funil (já
// calculadas por lib/data/funil.ts, normalmente sobre os últimos 3
// meses) para trabalhar ao contrário. O investimento em marketing (CAC)
// fica de fora: sem custos de marketing registados (marketing_costs
// está vazia), não há CAC real para usar.
export function calcularFunilInverso(
  clientesDesejados: number,
  funil: { total: number; porEtapa: Record<string, number> },
  contactosNoPeriodo: number
): FunilInverso {
  const taxaConversao = funil.total > 0 ? (funil.porEtapa['Ganha'] ?? 0) / funil.total : 0
  const taxaExperimental = funil.total > 0 ? (funil.porEtapa['Experimental agendada'] ?? 0) / funil.total : 0
  const contactosPorLead = funil.total > 0 ? contactosNoPeriodo / funil.total : 0

  const leadsNecessarias = taxaConversao > 0 ? clientesDesejados / taxaConversao : null

  return {
    leadsNecessarias: leadsNecessarias != null ? Math.ceil(leadsNecessarias) : null,
    experimentaisNecessarias:
      leadsNecessarias != null ? Math.ceil(leadsNecessarias * taxaExperimental) : null,
    contactosNecessarios: leadsNecessarias != null ? Math.ceil(leadsNecessarias * contactosPorLead) : null,
  }
}
