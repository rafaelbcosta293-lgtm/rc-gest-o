import { describe, expect, it } from 'vitest'
import { calcularFechoCaixa, somarNumerario } from './fechoCaixa'

describe('somarNumerario', () => {
  it('soma só os pagamentos em Numerário', () => {
    const total = somarNumerario([
      { valor: 30, metodo: 'Numerário' },
      { valor: 20, metodo: 'Multibanco' },
      { valor: 15.5, metodo: 'Numerário' },
      { valor: 10, metodo: null },
    ])
    expect(total).toBe(45.5)
  })

  it('devolve 0 quando não há pagamentos em numerário', () => {
    expect(somarNumerario([{ valor: 20, metodo: 'Cartão' }])).toBe(0)
    expect(somarNumerario([])).toBe(0)
  })

  it('arredonda a 2 casas decimais', () => {
    const total = somarNumerario([
      { valor: 10.111, metodo: 'Numerário' },
      { valor: 10.115, metodo: 'Numerário' },
    ])
    expect(total).toBe(20.23)
  })
})

describe('calcularFechoCaixa', () => {
  it('calcula o valor esperado como saldo anterior + numerário do dia', () => {
    const { valorEsperado } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 120.5,
      valorContado: 170.5,
    })
    expect(valorEsperado).toBe(170.5)
  })

  it('diferença é 0 quando o valor contado coincide com o esperado', () => {
    const { diferenca } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 120.5,
      valorContado: 170.5,
    })
    expect(diferenca).toBe(0)
  })

  it('diferença positiva quando há dinheiro a mais em caixa', () => {
    const { diferenca } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 100,
      valorContado: 155,
    })
    expect(diferenca).toBe(5)
  })

  it('diferença negativa quando falta dinheiro em caixa', () => {
    const { diferenca } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 100,
      valorContado: 140,
    })
    expect(diferenca).toBe(-10)
  })
})
