import { describe, expect, it } from 'vitest'
import { calcularFechoCaixa, somarNumerario, somarSaidas } from './fechoCaixa'

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

describe('somarSaidas', () => {
  it('soma todas as saídas, independentemente do tipo', () => {
    const total = somarSaidas([{ valor: 20 }, { valor: 15.5 }])
    expect(total).toBe(35.5)
  })

  it('devolve 0 quando não há saídas', () => {
    expect(somarSaidas([])).toBe(0)
  })

  it('arredonda a 2 casas decimais', () => {
    expect(somarSaidas([{ valor: 10.111 }, { valor: 10.115 }])).toBe(20.23)
  })
})

describe('calcularFechoCaixa', () => {
  it('calcula o valor esperado como saldo anterior + numerário do dia - saídas', () => {
    const { valorEsperado } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 120.5,
      saidasCaixaDia: 0,
      valorContado: 170.5,
    })
    expect(valorEsperado).toBe(170.5)
  })

  it('as saídas reduzem o valor esperado', () => {
    const { valorEsperado } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 120.5,
      saidasCaixaDia: 30,
      valorContado: 0,
    })
    expect(valorEsperado).toBe(140.5)
  })

  it('diferença é 0 quando o valor contado coincide com o esperado', () => {
    const { diferenca } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 120.5,
      saidasCaixaDia: 0,
      valorContado: 170.5,
    })
    expect(diferenca).toBe(0)
  })

  it('diferença positiva quando há dinheiro a mais em caixa', () => {
    const { diferenca } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 100,
      saidasCaixaDia: 0,
      valorContado: 155,
    })
    expect(diferenca).toBe(5)
  })

  it('diferença negativa quando falta dinheiro em caixa', () => {
    const { diferenca } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 100,
      saidasCaixaDia: 0,
      valorContado: 140,
    })
    expect(diferenca).toBe(-10)
  })

  it('diferença correta quando há saídas registadas', () => {
    const { diferenca } = calcularFechoCaixa({
      saldoAnterior: 50,
      valorNumerarioDia: 100,
      saidasCaixaDia: 20,
      valorContado: 130,
    })
    expect(diferenca).toBe(0)
  })
})
