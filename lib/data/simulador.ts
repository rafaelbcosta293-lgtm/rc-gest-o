// Simulador "E se…" (secção 6.3, só Administração). Puramente
// hipotético — ao contrário dos outros painéis desta fase, não lê
// nenhum histórico: são fórmulas de negócio simples sobre números que
// o utilizador escolhe, por isso não precisa de dados reais para ter
// integridade (ao contrário de "Projeções", que ficou de fora por
// faltar histórico).

export type EntradasSimulador = {
  leadsPorMes: number
  taxaFecho: number // 0–1, lead → cliente
  churnMensal: number // 0–1
  precoMedio: number // € por cliente por mês (ARPU hipotético)
  margemBrutaPct: number // 0–1, para o LTV — distinta da margem operacional abaixo
  nPts: number
  custoHoraPt: number // €
  horasPorPtPorMes: number
  custoMarketingMensal: number // €
  terceiroEstudio: boolean
  custosFixosTerceiroEstudio: number // € por mês, só soma se terceiroEstudio
}

export type ResultadoSimulador = {
  novosClientesPorMes: number
  // null quando churnMensal é 0: a base de clientes cresce sem limite,
  // nunca estabiliza — não é um número grande, é "sem estado estável".
  clientesEstaveis: number | null
  mrr: number | null
  custoTotalMensal: number
  margem: number | null
  margemPct: number | null
  pontoDeEquilibrioClientes: number | null
  cac: number | null
  ltv: number | null
  ratioLtvCac: number | null
  mesesParaRecuperarCac: number | null
}

export function simular(e: EntradasSimulador): ResultadoSimulador {
  const novosClientesPorMes = e.leadsPorMes * e.taxaFecho
  const clientesEstaveis = e.churnMensal > 0 ? novosClientesPorMes / e.churnMensal : null

  const custoTotalMensal =
    e.nPts * e.custoHoraPt * e.horasPorPtPorMes +
    e.custoMarketingMensal +
    (e.terceiroEstudio ? e.custosFixosTerceiroEstudio : 0)

  const mrr = clientesEstaveis != null ? clientesEstaveis * e.precoMedio : null
  const margem = mrr != null ? mrr - custoTotalMensal : null
  const margemPct = mrr != null && mrr > 0 ? margem! / mrr : null

  const pontoDeEquilibrioClientes = e.precoMedio > 0 ? custoTotalMensal / e.precoMedio : null
  const cac = novosClientesPorMes > 0 ? e.custoMarketingMensal / novosClientesPorMes : null
  const ltv =
    e.churnMensal > 0 ? (e.precoMedio * e.margemBrutaPct) / e.churnMensal : null
  const ratioLtvCac = ltv != null && cac != null && cac > 0 ? ltv / cac : null
  const mesesParaRecuperarCac =
    cac != null && e.precoMedio > 0 && e.margemBrutaPct > 0 ? cac / (e.precoMedio * e.margemBrutaPct) : null

  return {
    novosClientesPorMes,
    clientesEstaveis,
    mrr,
    custoTotalMensal,
    margem,
    margemPct,
    pontoDeEquilibrioClientes,
    cac,
    ltv,
    ratioLtvCac,
    mesesParaRecuperarCac,
  }
}
