// Painel financeiro (secção 4.5, só Administração). Tudo calculado em
// JS puro sobre dados já carregados, mesma abordagem dos outros
// painéis desta fase — mas aqui, por ser a área mais sensível
// (dinheiro), cada função documenta exatamente o que está a medir e
// onde a aproximação fica curta face ao que a especificação pedia.

// MRR "reconhecido": soma do valor do pagamento mais recente de cada
// cliente ainda dentro da validade (em dia). Um cliente em atraso não
// entra — não está, neste momento, a gerar receita recorrente
// confirmada. Isto não decompõe "novo/expansão/contração/churn/
// reativação" por falta de histórico de mudanças de plano por cliente
// (fica para quando essa informação existir).
export function mrrAtual(pagamentosRecentesPorCliente: { valor: number; valido_ate: string }[], hojeISO: string): number {
  return pagamentosRecentesPorCliente
    .filter((p) => p.valido_ate >= hojeISO)
    .reduce((soma, p) => soma + p.valor, 0)
}

// "Receita cobrada por mês", não "MRR por mês" — é dinheiro que
// efetivamente entrou (data_pagamento), não um valor recorrente
// reconhecido num calendário de subscrição que esta app não modela.
export function receitaPorMes(
  pagamentos: { valor: number; data_pagamento: string }[],
  meses: string[] // "YYYY-MM", mais antigo primeiro
): number[] {
  return meses.map((m) =>
    pagamentos.filter((p) => p.data_pagamento.slice(0, 7) === m).reduce((soma, p) => soma + p.valor, 0)
  )
}

export function arpu(mrr: number, clientesAtivos: number): number {
  return clientesAtivos > 0 ? mrr / clientesAtivos : 0
}

export function taxaPagamentoAteDia8(
  pagamentosDoMes: { data_pagamento: string }[],
  diaLimite = 8
): number {
  if (pagamentosDoMes.length === 0) return 0
  const ateODia8 = pagamentosDoMes.filter((p) => Number(p.data_pagamento.slice(8, 10)) <= diaLimite).length
  return ateODia8 / pagamentosDoMes.length
}

export type FaixaDivida = { faixa: string; clientes: number; valorAproximado: number }

// Antiguidade da dívida por cliente em atraso — "valorAproximado" usa
// o valor do último pagamento conhecido como proxy da mensalidade
// (esta app não guarda um valor em dívida separado, só pagamentos já
// recebidos).
export function agingDivida(
  clientesEmAtraso: { diasEmAtraso: number; ultimoValor: number }[]
): FaixaDivida[] {
  const faixas: { faixa: string; min: number; max: number }[] = [
    { faixa: '1–8 dias', min: 1, max: 8 },
    { faixa: '9–30 dias', min: 9, max: 30 },
    { faixa: '31–60 dias', min: 31, max: 60 },
    { faixa: 'mais de 60 dias', min: 61, max: Infinity },
  ]
  return faixas.map(({ faixa, min, max }) => {
    const nesta = clientesEmAtraso.filter((c) => c.diasEmAtraso >= min && c.diasEmAtraso <= max)
    return {
      faixa,
      clientes: nesta.length,
      valorAproximado: nesta.reduce((soma, c) => soma + c.ultimoValor, 0),
    }
  })
}

export type Margem = { receitaPorHora: number; custoPorHora: number; margemPorHora: number }

export function margemPorHora(receitaTotal: number, horasTotais: number, custoHoraPt: number): Margem {
  const receitaPorHora = horasTotais > 0 ? receitaTotal / horasTotais : 0
  return { receitaPorHora, custoPorHora: custoHoraPt, margemPorHora: receitaPorHora - custoHoraPt }
}

// Últimos "n" meses, no formato "YYYY-MM", terminando no mês de
// "hojeISO" (inclusive) — sem usar Date.now()/new Date() sem data
// explícita, só aritmética sobre a própria data.
export function ultimosMeses(hojeISO: string, n: number): string[] {
  const ano = Number(hojeISO.slice(0, 4))
  const mes = Number(hojeISO.slice(5, 7))
  const meses: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    let m = mes - i
    let a = ano
    while (m <= 0) {
      m += 12
      a -= 1
    }
    meses.push(`${a}-${String(m).padStart(2, '0')}`)
  }
  return meses
}

export function parseValorConfig(valor: string | null | undefined): number | null {
  if (!valor) return null
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
