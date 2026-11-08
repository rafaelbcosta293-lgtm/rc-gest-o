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

// Sangrias e compras pagas com o dinheiro da gaveta — tudo o que sai
// da caixa física sem ser pagamento a um cliente.
export function somarSaidas(saidas: { valor: number }[]): number {
  return arredondar(saidas.reduce((soma, s) => soma + s.valor, 0))
}

export function calcularFechoCaixa({
  saldoAnterior,
  valorNumerarioDia,
  saidasCaixaDia,
  valorContado,
}: {
  saldoAnterior: number
  valorNumerarioDia: number
  saidasCaixaDia: number
  valorContado: number
}): { valorEsperado: number; diferenca: number } {
  const valorEsperado = arredondar(saldoAnterior + valorNumerarioDia - saidasCaixaDia)
  return {
    valorEsperado,
    diferenca: arredondar(valorContado - valorEsperado),
  }
}
