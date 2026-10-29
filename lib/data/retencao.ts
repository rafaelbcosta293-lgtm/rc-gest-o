// Painel de clientes e retenção (secção 4.3). Tudo calculado em JS
// puro sobre dados já carregados — mesma abordagem de lib/data/funil.ts
// e lib/data/comercial.ts.

export type ClienteParaRetencao = {
  id: string
  estado: string
  frequencia_semanal: number | null
  inicio_contrato: string | null
  fim_experiencia: string | null
  saiu_em: string | null
}

function somarMeses(dataISO: string, meses: number): string {
  const d = new Date(`${dataISO}T00:00:00`)
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

function mesesEntre(deISO: string, paraISO: string): number {
  const de = new Date(`${deISO}T00:00:00`)
  const para = new Date(`${paraISO}T00:00:00`)
  return (para.getFullYear() - de.getFullYear()) * 12 + (para.getMonth() - de.getMonth())
}

export type ResumoMensalClientes = {
  ativos: number
  novos: number
  cancelados: number
  suspensos: number
  reativados: number
}

// "cancelados"/"suspensos"/"reativados" vêm de "activities" (gravadas
// pelo trigger atividade_de_cliente, já existente) em vez do estado
// atual — é a única forma de saber O QUE ACONTECEU dentro do mês, já
// que o estado em "clientes" só guarda a situação de agora.
export function resumoMensalClientes(
  clientes: ClienteParaRetencao[],
  atividades: { tipo: string; criado_em: string }[],
  inicioISO: string,
  fimExclusivoISO: string
): ResumoMensalClientes {
  const noMes = (iso: string) => iso >= inicioISO && iso < fimExclusivoISO
  return {
    ativos: clientes.filter((c) => c.estado === 'Ativo').length,
    novos: clientes.filter((c) => c.inicio_contrato && noMes(c.inicio_contrato)).length,
    cancelados: atividades.filter((a) => a.tipo === 'Cancelamento' && noMes(a.criado_em.slice(0, 10))).length,
    suspensos: atividades.filter((a) => a.tipo === 'Suspensão' && noMes(a.criado_em.slice(0, 10))).length,
    reativados: atividades.filter((a) => a.tipo === 'Reativação' && noMes(a.criado_em.slice(0, 10))).length,
  }
}

// Aproximação: sem um snapshot diário de "ativos" (kpi_snapshots_daily
// ainda não é alimentada), usa-se ativos-agora + cancelados-no-mês como
// proxy de "ativos no início do mês".
export function churnMensal(ativosAgora: number, canceladosNoMes: number): number {
  const base = ativosAgora + canceladosNoMes
  return base > 0 ? canceladosNoMes / base : 0
}

export type CancelamentoFimExperiencia = { total: number; cancelados: number; taxa: number }

export function cancelamentoFimExperiencia(
  clientes: ClienteParaRetencao[],
  hojeISO: string,
  diasTolerancia = 7
): CancelamentoFimExperiencia {
  const comExperienciaConcluida = clientes.filter((c) => c.fim_experiencia && c.fim_experiencia < hojeISO)
  const cancelados = comExperienciaConcluida.filter((c) => {
    if (!c.saiu_em || !c.fim_experiencia) return false
    const dias =
      (new Date(`${c.saiu_em}T00:00:00`).getTime() - new Date(`${c.fim_experiencia}T00:00:00`).getTime()) /
      86_400_000
    return Math.abs(dias) <= diasTolerancia
  })
  return {
    total: comExperienciaConcluida.length,
    cancelados: cancelados.length,
    taxa: comExperienciaConcluida.length > 0 ? cancelados.length / comExperienciaConcluida.length : 0,
  }
}

export function tempoMedioDeVidaMeses(clientes: ClienteParaRetencao[]): number | null {
  const comVidaCompleta = clientes.filter((c) => c.inicio_contrato && c.saiu_em)
  if (comVidaCompleta.length === 0) return null
  const soma = comVidaCompleta.reduce(
    (total, c) => total + mesesEntre(c.inicio_contrato!, c.saiu_em!),
    0
  )
  return soma / comVidaCompleta.length
}

export function mixFrequencia(clientes: ClienteParaRetencao[]): { frequencia: string; total: number }[] {
  const mapa = new Map<string, number>()
  for (const c of clientes) {
    const chave = c.frequencia_semanal ? `${c.frequencia_semanal}x/semana` : 'Sem definição'
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1)
  }
  return Array.from(mapa.entries())
    .map(([frequencia, total]) => ({ frequencia, total }))
    .sort((a, b) => b.total - a.total)
}

export type LinhaCoorte = { cohort: string; tamanho: number; retencaoPorMes: (number | null)[] }

// Matriz de coortes: agrupa clientes pelo mês de "inicio_contrato" e,
// para cada mês 1..maxMeses desde a entrada, calcula a % que continua
// "ativa" nesse ponto (null quando a coorte ainda não tem idade
// suficiente para esse mês ter acontecido).
export function matrizCoorte(
  clientes: ClienteParaRetencao[],
  hojeISO: string,
  maxMeses = 12
): LinhaCoorte[] {
  const porCoorte = new Map<string, ClienteParaRetencao[]>()
  for (const c of clientes) {
    if (!c.inicio_contrato) continue
    const chave = c.inicio_contrato.slice(0, 7) // YYYY-MM
    const lista = porCoorte.get(chave) ?? []
    lista.push(c)
    porCoorte.set(chave, lista)
  }

  const linhas: LinhaCoorte[] = []
  for (const [cohort, membros] of Array.from(porCoorte.entries()).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const inicioCoorte = `${cohort}-01`
    const retencaoPorMes: (number | null)[] = []
    for (let m = 1; m <= maxMeses; m++) {
      const marca = somarMeses(inicioCoorte, m)
      if (marca > hojeISO) {
        retencaoPorMes.push(null)
        continue
      }
      const ativosNessaMarca = membros.filter((c) => !c.saiu_em || c.saiu_em >= marca).length
      retencaoPorMes.push(ativosNessaMarca / membros.length)
    }
    linhas.push({ cohort, tamanho: membros.length, retencaoPorMes })
  }
  return linhas
}

export type SinaisRisco = {
  quebraAssiduidade: number // 0 (sem quebra) a 1 (não apareceu nada)
  desmarcacoesRecentes: number
  temTreinoAgendado: boolean
  emDia: boolean
  reavaliacaoVencida: boolean
  diasParaFimExperiencia: number | null
}

// Pesos de uma primeira calibração (a especificação pede para combinar
// estes sinais, mas não dá os pesos) — fáceis de ajustar aqui no
// mesmo sítio se a prática mostrar que algum fator pesa mais ou menos
// do que isto.
export function scoreRisco(sinais: SinaisRisco): number {
  let pontos = 0
  pontos += Math.max(0, Math.min(1, sinais.quebraAssiduidade)) * 35
  pontos += Math.min(20, sinais.desmarcacoesRecentes * 7)
  if (!sinais.temTreinoAgendado) pontos += 20
  if (!sinais.emDia) pontos += 15
  if (sinais.reavaliacaoVencida) pontos += 5
  if (
    sinais.diasParaFimExperiencia !== null &&
    sinais.diasParaFimExperiencia >= 0 &&
    sinais.diasParaFimExperiencia <= 7
  ) {
    pontos += 5
  }
  return Math.round(Math.min(100, pontos))
}
