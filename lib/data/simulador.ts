// Simulador "E se…" (Administração). Parte dos rácios REAIS do negócio
// (calculados a partir dos pagamentos, leads e horas de PT — ver
// app/painel/admin/simulador/page.tsx) e projeta o que acontece quando
// se mexe num deles ou numa meta. Os volumes estão todos ligados pelos
// rácios: mudar uma meta (ex.: 250 clientes) recalcula as outras
// (leads, novos clientes, MRR, PTs, custos) com os rácios atuais.

export type Racios = {
  taxaFecho: number // 0–1: novos clientes ÷ leads
  churn: number // 0–1 por mês: clientes perdidos ÷ clientes do mês anterior
  arpu: number // € por cliente por mês
  horasPtPorCliente: number // horas de PT por cliente por mês
  horasPorPt: number // horas que cada PT dá por mês
  custoHoraPt: number // €
  custoPorLead: number // € de marketing por lead
  custosFixos: number // € por mês (rendas, salários fixos, 3º estúdio…)
}

export type Cenario = Racios & { leadsMes: number }

export type ResultadoCenario = {
  leadsMes: number
  novosMes: number
  clientesEstaveis: number | null // null: churn 0, a base nunca estabiliza
  mrr: number | null
  arr: number | null
  horasPtMes: number | null
  ptsNecessarios: number | null
  custoPt: number | null
  custoMarketing: number
  custoTotal: number | null
  margem: number | null
  margemPct: number | null
  margemContribuicaoCliente: number // € por cliente/mês depois do custo de PT
  pontoEquilibrioClientes: number | null
  cac: number | null
  ltv: number | null
  ratioLtvCac: number | null
  mesesRecuperarCac: number | null
  vidaMediaMeses: number | null
}

export function calcularCenario(c: Cenario): ResultadoCenario {
  const novosMes = c.leadsMes * c.taxaFecho
  const clientesEstaveis = c.churn > 0 ? novosMes / c.churn : null
  const mrr = clientesEstaveis != null ? clientesEstaveis * c.arpu : null
  const horasPtMes = clientesEstaveis != null ? clientesEstaveis * c.horasPtPorCliente : null
  const ptsNecessarios = horasPtMes != null && c.horasPorPt > 0 ? horasPtMes / c.horasPorPt : null
  const custoPt = horasPtMes != null ? horasPtMes * c.custoHoraPt : null
  const custoMarketing = c.leadsMes * c.custoPorLead
  const custoTotal = custoPt != null ? custoPt + custoMarketing + c.custosFixos : null
  const margem = mrr != null && custoTotal != null ? mrr - custoTotal : null
  const margemPct = margem != null && mrr ? margem / mrr : null
  const margemContribuicaoCliente = c.arpu - c.horasPtPorCliente * c.custoHoraPt
  const pontoEquilibrioClientes =
    margemContribuicaoCliente > 0 ? (custoMarketing + c.custosFixos) / margemContribuicaoCliente : null
  const cac = novosMes > 0 ? custoMarketing / novosMes : null
  const ltv = c.churn > 0 ? margemContribuicaoCliente / c.churn : null
  const ratioLtvCac = ltv != null && cac ? ltv / cac : null
  const mesesRecuperarCac = cac != null && margemContribuicaoCliente > 0 ? cac / margemContribuicaoCliente : null
  return {
    leadsMes: c.leadsMes,
    novosMes,
    clientesEstaveis,
    mrr,
    arr: mrr != null ? mrr * 12 : null,
    horasPtMes,
    ptsNecessarios,
    custoPt,
    custoMarketing,
    custoTotal,
    margem,
    margemPct,
    margemContribuicaoCliente,
    pontoEquilibrioClientes,
    cac,
    ltv,
    ratioLtvCac,
    mesesRecuperarCac,
    vidaMediaMeses: c.churn > 0 ? 1 / c.churn : null,
  }
}

export type Meta = 'leadsMes' | 'novosMes' | 'clientes' | 'mrr' | 'pts' | 'marketing'

// Volta à única variável de partida (leads por mês) a partir de uma
// meta, com os rácios do cenário: é isto que liga todos os campos.
export function leadsParaMeta(meta: Meta, valor: number, c: Racios): number | null {
  const v = Math.max(0, valor)
  const porNovo = c.taxaFecho > 0 ? 1 / c.taxaFecho : null
  switch (meta) {
    case 'leadsMes':
      return v
    case 'novosMes':
      return porNovo != null ? v * porNovo : null
    case 'clientes':
      return porNovo != null ? v * c.churn * porNovo : null
    case 'mrr':
      return porNovo != null && c.arpu > 0 ? (v / c.arpu) * c.churn * porNovo : null
    case 'pts':
      return porNovo != null && c.horasPtPorCliente > 0 ? ((v * c.horasPorPt) / c.horasPtPorCliente) * c.churn * porNovo : null
    case 'marketing':
      return c.custoPorLead > 0 ? v / c.custoPorLead : null
  }
}

// Evolução mês a mês a partir da base atual de clientes:
//   clientes(t+1) = clientes(t) × (1 − churn) + novos
export function trajetoria(clientesAtuais: number, c: Cenario, meses: number): { clientes: number; receita: number }[] {
  const novos = c.leadsMes * c.taxaFecho
  const pontos: { clientes: number; receita: number }[] = []
  let clientes = clientesAtuais
  for (let i = 0; i < meses; i++) {
    clientes = clientes * (1 - c.churn) + novos
    pontos.push({ clientes, receita: clientes * c.arpu })
  }
  return pontos
}
