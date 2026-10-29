import { describe, expect, it } from 'vitest'
import {
  mrrAtual,
  receitaPorMes,
  arpu,
  taxaPagamentoAteDia8,
  agingDivida,
  margemPorHora,
  parseValorConfig,
  ultimosMeses,
} from './financeiro'

describe('mrrAtual', () => {
  it('soma só os pagamentos ainda dentro da validade (em dia)', () => {
    const r = mrrAtual(
      [
        { valor: 50, valido_ate: '2026-04-01' },
        { valor: 60, valido_ate: '2026-02-01' }, // já venceu
      ],
      '2026-03-01'
    )
    expect(r).toBe(50)
  })
})

describe('receitaPorMes', () => {
  it('soma o valor pago em cada mês pedido, por data_pagamento', () => {
    const pagamentos = [
      { valor: 50, data_pagamento: '2026-02-10' },
      { valor: 30, data_pagamento: '2026-02-20' },
      { valor: 40, data_pagamento: '2026-03-05' },
    ]
    expect(receitaPorMes(pagamentos, ['2026-02', '2026-03'])).toEqual([80, 40])
  })
})

describe('arpu', () => {
  it('é mrr / clientes ativos, 0 sem nenhum cliente', () => {
    expect(arpu(1000, 20)).toBe(50)
    expect(arpu(1000, 0)).toBe(0)
  })
})

describe('taxaPagamentoAteDia8', () => {
  it('calcula a proporção de pagamentos feitos até ao dia-limite', () => {
    const r = taxaPagamentoAteDia8(
      [{ data_pagamento: '2026-03-05' }, { data_pagamento: '2026-03-08' }, { data_pagamento: '2026-03-15' }],
      8
    )
    expect(r).toBeCloseTo(2 / 3)
  })

  it('devolve 0 sem nenhum pagamento no mês', () => {
    expect(taxaPagamentoAteDia8([])).toBe(0)
  })
})

describe('agingDivida', () => {
  it('distribui cada cliente em atraso na faixa certa, com o valor aproximado somado', () => {
    const r = agingDivida([
      { diasEmAtraso: 5, ultimoValor: 50 },
      { diasEmAtraso: 20, ultimoValor: 60 },
      { diasEmAtraso: 90, ultimoValor: 40 },
    ])
    expect(r.find((f) => f.faixa === '1–8 dias')).toEqual({ faixa: '1–8 dias', clientes: 1, valorAproximado: 50 })
    expect(r.find((f) => f.faixa === 'mais de 60 dias')?.clientes).toBe(1)
    expect(r.find((f) => f.faixa === '31–60 dias')?.clientes).toBe(0)
  })
})

describe('margemPorHora', () => {
  it('margem é receita por hora menos custo por hora', () => {
    const m = margemPorHora(1000, 50, 8)
    expect(m.receitaPorHora).toBe(20)
    expect(m.margemPorHora).toBe(12)
  })

  it('receita por hora é 0 sem nenhuma hora registada', () => {
    expect(margemPorHora(1000, 0, 8).receitaPorHora).toBe(0)
  })
})

describe('ultimosMeses', () => {
  it('devolve os últimos n meses terminando no mês de hoje, atravessando a virada de ano', () => {
    expect(ultimosMeses('2026-01-15', 3)).toEqual(['2025-11', '2025-12', '2026-01'])
  })

  it('com n=1 devolve só o mês atual', () => {
    expect(ultimosMeses('2026-03-20', 1)).toEqual(['2026-03'])
  })
})

describe('parseValorConfig', () => {
  it('converte vírgula decimal para ponto', () => {
    expect(parseValorConfig('8,50')).toBe(8.5)
  })

  it('devolve null para valores em falta ou inválidos', () => {
    expect(parseValorConfig(null)).toBeNull()
    expect(parseValorConfig('')).toBeNull()
    expect(parseValorConfig('abc')).toBeNull()
  })
})
