// Meses entre o início de contrato e hoje (ou até à saída, se já não é
// cliente). Arredondado por baixo — "3 meses" só depois de passarem 3
// meses completos.
export function mesesAtivo(inicioContrato: string | null, saiuEm: string | null): number | null {
  if (!inicioContrato) return null
  const inicio = new Date(`${inicioContrato}T00:00:00`)
  const fim = saiuEm ? new Date(`${saiuEm}T00:00:00`) : new Date()

  let meses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth())
  if (fim.getDate() < inicio.getDate()) meses--
  return Math.max(0, meses)
}

// Desde que data (YYYY-MM-DD) está este cliente em dívida com o
// seguro, neste ciclo — ou null se ainda não há nenhuma renovação
// pendente. O seguro renova todos os anos no mês em que o cliente
// entrou (ex.: entrou em fevereiro de 2025 → a 1ª renovação fica em
// dívida a partir de 1 de fevereiro de 2026, nunca no próprio ano de
// inscrição). Uma vez em dívida, a data não muda só porque o mês civil
// passou — fica a mesma até ao ciclo seguinte (o aniversário do ano a
// seguir) ou até ser paga (ver segurosPorPagar).
export function dataRenovacaoSeguroEmDivida(inicioContrato: string | null, hoje: Date): string | null {
  if (!inicioContrato) return null
  const anoInicio = Number(inicioContrato.slice(0, 4))
  const mesInicio = Number(inicioContrato.slice(5, 7))
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1

  // Antes de chegar o mês de aniversário este ano, o ciclo "atual"
  // ainda é o do ano passado (pode continuar em dívida desde aí).
  const anoRenovacao = mesAtual >= mesInicio ? anoAtual : anoAtual - 1
  if (anoRenovacao <= anoInicio) return null

  return `${anoRenovacao}-${String(mesInicio).padStart(2, '0')}-01`
}

// Já passou pelo menos 1 ano completo entre estas duas datas? Usado
// para decidir se uma reativação apanhou o seguro já caducado (reinicia
// o ciclo) ou ainda dentro do ano em curso (não muda nada).
function passouUmAno(desde: string, ate: string): boolean {
  const limite = new Date(`${desde}T00:00:00`)
  limite.setFullYear(limite.getFullYear() + 1)
  return new Date(`${ate}T00:00:00`) >= limite
}

// A âncora do seguro começa na inscrição e só "salta" para uma
// reativação quando, nessa reativação, já tinha passado mais de 1 ano
// desde a âncora anterior — ou seja, o seguro já tinha mesmo caducado
// enquanto o cliente esteve fora (ex.: entrou em jan/2024, saiu em
// ago/2024, volta em mar/2025 → passa a contar de mar/2025). Uma
// reativação ainda dentro do ano em curso não muda nada (ex.: entrou em
// jan/2024, saiu em ago/2024, volta em nov/2024 → continua a contar de
// jan/2024, válido até jan/2025). reativacoesOrdenadas tem de vir em
// ordem crescente — percorre-as todas para o caso de haver mais do que
// uma reativação ao longo do tempo.
function ancoraSeguro(inicioContrato: string, reativacoesOrdenadas: string[]): string {
  let ancora = inicioContrato
  for (const r of reativacoesOrdenadas) {
    if (passouUmAno(ancora, r)) {
      ancora = r
    }
  }
  return ancora
}

// Dos clientes dados (normalmente só os ativos), devolve os que têm
// uma renovação de seguro em dívida e ainda sem pagamento registado
// (um pagamento com inclui_seguro=true, datado a partir da data em que
// ficou em dívida, conta como pago). pagamentosSeguro só precisa de
// cliente_id/data_pagamento dos pagamentos com inclui_seguro=true
// desses clientes — não é preciso filtrar por data antes de chamar.
// pagamentosReativacao (cliente_id/data_pagamento dos pagamentos com
// inclui_reativacao=true) é opcional — ver ancoraSeguro para a regra de
// quando uma reativação reinicia o ciclo.
export function segurosPorPagar<T extends { id: string; inicio_contrato: string | null }>(
  clientes: T[],
  hoje: Date,
  pagamentosSeguro: { cliente_id: string; data_pagamento: string }[],
  pagamentosReativacao: { cliente_id: string; data_pagamento: string }[] = []
): (T & { dataRenovacao: string })[] {
  const datasPagasPorCliente = new Map<string, string[]>()
  for (const p of pagamentosSeguro) {
    const datas = datasPagasPorCliente.get(p.cliente_id) ?? []
    datas.push(p.data_pagamento)
    datasPagasPorCliente.set(p.cliente_id, datas)
  }

  const reativacoesPorCliente = new Map<string, string[]>()
  for (const p of pagamentosReativacao) {
    const datas = reativacoesPorCliente.get(p.cliente_id) ?? []
    datas.push(p.data_pagamento)
    reativacoesPorCliente.set(p.cliente_id, datas)
  }

  const resultado: (T & { dataRenovacao: string })[] = []
  for (const c of clientes) {
    if (!c.inicio_contrato) continue
    const reativacoes = (reativacoesPorCliente.get(c.id) ?? []).slice().sort()
    const ancora = ancoraSeguro(c.inicio_contrato, reativacoes)
    const dataRenovacao = dataRenovacaoSeguroEmDivida(ancora, hoje)
    if (!dataRenovacao) continue
    const datasPagas = datasPagasPorCliente.get(c.id) ?? []
    const jaPago = datasPagas.some((data) => data >= dataRenovacao)
    if (!jaPago) resultado.push({ ...c, dataRenovacao })
  }
  return resultado
}
