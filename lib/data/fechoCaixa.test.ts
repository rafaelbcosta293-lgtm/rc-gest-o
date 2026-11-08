import { describe, expect, it } from 'vitest'
import {
  calcularFechoCaixa,
  descricaoPagamento,
  grupoMetodo,
  somarNumerario,
  somarPorGrupoMetodo,
  somarSaidas,
} from './fechoCaixa'

describe('grupoMetodo', () => {
  it('agrupa Numerário sozinho', () => {
    expect(grupoMetodo('Numerário')).toBe('Numerário')
  })

  it('agrupa MB Way e Transferência em "MB Way / SEPA"', () => {
    expect(grupoMetodo('MB Way')).toBe('MB Way / SEPA')
    expect(grupoMetodo('Transferência')).toBe('MB Way / SEPA')
  })

  it('agrupa Multibanco e Cartão em TPA', () => {
    expect(grupoMetodo('Multibanco')).toBe('TPA')
    expect(grupoMetodo('Cartão')).toBe('TPA')
  })

  it('trata método desconhecido ou nulo como Numerário', () => {
    expect(grupoMetodo(null)).toBe('Numerário')
    expect(grupoMetodo('Outro qualquer')).toBe('Numerário')
  })
})

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

describe('somarPorGrupoMetodo', () => {
  it('agrupa e soma os 3 grupos corretamente', () => {
    const totais = somarPorGrupoMetodo([
      { valor: 18.5, metodo: 'MB Way' },
      { valor: 100, metodo: 'MB Way' },
      { valor: 140, metodo: 'Transferência' },
      { valor: 50, metodo: 'Multibanco' },
      { valor: 30, metodo: 'Numerário' },
    ])
    expect(totais).toEqual({
      'Numerário': 30,
      'MB Way / SEPA': 258.5,
      TPA: 50,
    })
  })

  it('devolve zeros quando não há pagamentos', () => {
    expect(somarPorGrupoMetodo([])).toEqual({ 'Numerário': 0, 'MB Way / SEPA': 0, TPA: 0 })
  })
})

describe('descricaoPagamento', () => {
  it('devolve o nome do plano quando há plano', () => {
    expect(
      descricaoPagamento({
        plano: { nome: 'Premium 8' },
        inclui_inscricao: false,
        inclui_seguro: false,
        inclui_reativacao: false,
      })
    ).toBe('Premium 8')
  })

  it('acrescenta inscrição/seguro/reativação ao nome do plano', () => {
    expect(
      descricaoPagamento({
        plano: { nome: 'Premium 8' },
        inclui_inscricao: true,
        inclui_seguro: true,
        inclui_reativacao: false,
      })
    ).toBe('Premium 8 + inscrição + seguro')
  })

  it('devolve "Seguro" quando não há plano associado', () => {
    expect(
      descricaoPagamento({
        plano: null,
        inclui_inscricao: false,
        inclui_seguro: true,
        inclui_reativacao: false,
      })
    ).toBe('Seguro')
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
  const base = { saldoAnterior: 50, valorNumerarioDia: 120.5, saidasCaixaDia: 0, outrosEntradaDia: 0, outrosSaidaDia: 0 }

  it('calcula o valor esperado como saldo anterior + numerário do dia - saídas', () => {
    const { valorEsperado } = calcularFechoCaixa({ ...base, valorContado: 170.5 })
    expect(valorEsperado).toBe(170.5)
  })

  it('as saídas reduzem o valor esperado', () => {
    const { valorEsperado } = calcularFechoCaixa({ ...base, saidasCaixaDia: 30, valorContado: 0 })
    expect(valorEsperado).toBe(140.5)
  })

  it('"outros" entrada aumenta e "outros" saída reduz o valor esperado', () => {
    const { valorEsperado } = calcularFechoCaixa({
      ...base,
      outrosEntradaDia: 10,
      outrosSaidaDia: 5,
      valorContado: 0,
    })
    expect(valorEsperado).toBe(175.5)
  })

  it('diferença é 0 quando o valor contado coincide com o esperado', () => {
    const { diferenca } = calcularFechoCaixa({ ...base, valorContado: 170.5 })
    expect(diferenca).toBe(0)
  })

  it('diferença positiva quando há dinheiro a mais em caixa', () => {
    const { diferenca } = calcularFechoCaixa({ ...base, valorNumerarioDia: 100, valorContado: 155 })
    expect(diferenca).toBe(5)
  })

  it('diferença negativa quando falta dinheiro em caixa', () => {
    const { diferenca } = calcularFechoCaixa({ ...base, valorNumerarioDia: 100, valorContado: 140 })
    expect(diferenca).toBe(-10)
  })
})
