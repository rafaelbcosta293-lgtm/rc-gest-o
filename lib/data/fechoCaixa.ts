function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

export type GrupoMetodo = 'Numerário' | 'MB Way' | 'TPA / Transferências'

// Agrupa os métodos de pagamento nas 3 categorias que o estúdio já usa
// no fecho de caixa em papel: Numerário fica à parte (é o único que
// passa pela gaveta física); MB Way fica sozinho; Multibanco e
// Transferência vão para o mesmo grupo (TPA / Transferências).
export function grupoMetodo(metodo: string | null): GrupoMetodo {
  if (metodo === 'MB Way') return 'MB Way'
  if (metodo === 'Multibanco' || metodo === 'Transferência') return 'TPA / Transferências'
  return 'Numerário'
}

// Só os pagamentos em Numerário contam para o dinheiro que devia estar
// fisicamente em caixa — os outros métodos (Multibanco, MB Way, etc.)
// nunca passam pela caixa física.
export function somarNumerario(pagamentos: { valor: number; metodo: string | null }[]): number {
  return arredondar(
    pagamentos.filter((p) => p.metodo === 'Numerário').reduce((soma, p) => soma + p.valor, 0)
  )
}

export function somarPorGrupoMetodo(
  pagamentos: { valor: number; metodo: string | null }[]
): Record<GrupoMetodo, number> {
  const totais: Record<GrupoMetodo, number> = { 'Numerário': 0, 'MB Way': 0, 'TPA / Transferências': 0 }
  for (const p of pagamentos) {
    totais[grupoMetodo(p.metodo)] += p.valor
  }
  return {
    'Numerário': arredondar(totais['Numerário']),
    'MB Way': arredondar(totais['MB Way']),
    'TPA / Transferências': arredondar(totais['TPA / Transferências']),
  }
}

// A "descrição" que aparece junto do nome do sócio no fecho em papel —
// o nome do plano, ou "Seguro" quando é só o seguro a ser pago à
// parte (ver registarPagamentoSeguro, que não associa plano nenhum).
export function descricaoPagamento(p: {
  plano: { nome: string } | null
  inclui_inscricao: boolean
  inclui_seguro: boolean
  inclui_reativacao: boolean
}): string {
  if (!p.plano) return 'Seguro'
  const partes = [p.plano.nome.trim()]
  if (p.inclui_inscricao) partes.push('inscrição')
  if (p.inclui_seguro) partes.push('seguro')
  if (p.inclui_reativacao) partes.push('reativação')
  return partes.join(' + ')
}

// Sangrias e compras pagas com o dinheiro da gaveta — tudo o que sai
// da caixa física sem ser pagamento a um cliente.
export function somarSaidas(saidas: { valor: number }[]): number {
  return arredondar(saidas.reduce((soma, s) => soma + s.valor, 0))
}

export function calcularFechoCaixa({
  saldoAnterior,
  valorNumerarioDia,
  saidasCaixaDia,
  outrosEntradaDia,
  outrosSaidaDia,
  valorContado,
}: {
  saldoAnterior: number
  valorNumerarioDia: number
  saidasCaixaDia: number
  outrosEntradaDia: number
  outrosSaidaDia: number
  valorContado: number
}): { valorEsperado: number; diferenca: number } {
  const valorEsperado = arredondar(
    saldoAnterior + valorNumerarioDia + outrosEntradaDia - saidasCaixaDia - outrosSaidaDia
  )
  return {
    valorEsperado,
    diferenca: arredondar(valorContado - valorEsperado),
  }
}
