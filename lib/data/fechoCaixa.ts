function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

// Só os pagamentos em Numerário contam para o dinheiro que devia estar
// fisicamente em caixa — os outros métodos (Multibanco, MB Way, etc.)
// nunca passam pela caixa física.
export function somarNumerario(pagamentos: { valor: number; metodo: string | null }[]): number {
  return arredondar(
    pagamentos.filter((p) => p.metodo === 'Numerário').reduce((soma, p) => soma + p.valor, 0)
  )
}

export function calcularFechoCaixa({
  fundoTroco,
  valorNumerarioDia,
  valorContado,
}: {
  fundoTroco: number
  valorNumerarioDia: number
  valorContado: number
}): { valorEsperado: number; diferenca: number } {
  const valorEsperado = arredondar(fundoTroco + valorNumerarioDia)
  return {
    valorEsperado,
    diferenca: arredondar(valorContado - valorEsperado),
  }
}
