import { describe, expect, it } from 'vitest'
import {
  baseClientesMensal,
  cagr,
  estatisticas,
  indicesSazonais,
  mediaMovel,
  mesesEntre,
  periodoRecuado,
  projetarReceita,
  receitaMensal,
  regressaoLinear,
  resolverPeriodo,
  resumirPeriodo,
  variacao,
  type PagamentoAnalise,
} from './analiseFinanceira'

const pag = (cliente: string, data: string, valido: string, valor = 50, extra: Partial<PagamentoAnalise> = {}): PagamentoAnalise => ({
  cliente_id: cliente,
  estudio_id: 1,
  valor,
  desconto: 0,
  metodo: 'MB Way',
  plano_id: null,
  data_pagamento: data,
  valido_ate: valido,
  ...extra,
})

describe('períodos', () => {
  it('resolve mês, ano e desde sempre, cortando em hoje', () => {
    const mes = resolverPeriodo('mes', undefined, '2026-11-14', '2021-01-04')
    expect(mes).toMatchObject({ inicio: '2026-11-01', fim: '2026-11-14', parcial: true, rotulo: 'novembro 2026' })
    const ano = resolverPeriodo('ano', '2025', '2026-11-14', '2021-01-04')
    expect(ano).toMatchObject({ inicio: '2025-01-01', fim: '2025-12-31', parcial: false })
    const sempre = resolverPeriodo('sempre', undefined, '2026-11-14', '2021-01-04')
    expect(sempre).toMatchObject({ inicio: '2021-01-04', fim: '2026-11-14' })
  })

  it('compara até ao mesmo ponto quando o período está a decorrer', () => {
    const mes = resolverPeriodo('mes', '2026-03', '2026-03-31', '2021-01-01')
    expect(periodoRecuado(mes, 1)).toMatchObject({ inicio: '2026-02-01', fim: '2026-02-28' })
    const parcial = resolverPeriodo('mes', '2026-11', '2026-11-14', '2021-01-01')
    expect(periodoRecuado(parcial, 12)).toMatchObject({ inicio: '2025-11-01', fim: '2025-11-14' })
    const ano = resolverPeriodo('ano', '2026', '2026-11-14', '2021-01-01')
    expect(periodoRecuado(ano, 1)).toMatchObject({ inicio: '2025-01-01', fim: '2025-11-14' })
    expect(periodoRecuado(resolverPeriodo('sempre', undefined, '2026-11-14', '2021-01-01'), 1)).toBeNull()
  })

  it('lista meses', () => {
    expect(mesesEntre('2025-11-03', '2026-02-10')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('resumirPeriodo', () => {
  it('soma receita, descontos, ticket médio e mix', () => {
    const r = resumirPeriodo(
      [
        pag('a', '2026-01-05', '2026-01-31', 60, { desconto: 10 }),
        pag('a', '2026-01-20', '2026-01-20', 15, { metodo: 'Numerário' }),
        pag('b', '2026-01-10', '2026-01-31', 45, { estudio_id: 2 }),
        pag('c', '2026-02-01', '2026-02-28', 99),
      ],
      '2026-01-01',
      '2026-01-31'
    )
    expect(r.receita).toBe(120)
    expect(r.bruto).toBe(130)
    expect(r.taxaDesconto).toBeCloseTo(10 / 130)
    expect(r.pagamentos).toBe(3)
    expect(r.ticketMedio).toBe(40)
    expect(r.clientesPagantes).toBe(2)
    expect(r.receitaPorCliente).toBe(60)
    expect(r.porEstudio.get(2)).toBe(45)
    expect(r.porMetodo.get('Numerário')).toBe(15)
  })

  it('variação', () => {
    expect(variacao(110, 100)).toBeCloseTo(0.1)
    expect(variacao(10, 0)).toBeNull()
  })
})

describe('séries', () => {
  it('receita mensal por estúdio', () => {
    const r = receitaMensal([pag('a', '2026-01-05', '2026-01-31', 50), pag('b', '2026-02-05', '2026-02-28', 30, { estudio_id: 2 })], ['2026-01', '2026-02'])
    expect(r.total).toEqual([50, 30])
    expect(r.porEstudio.get(2)).toEqual([0, 30])
  })

  it('base de clientes: novos, perdidos, reativados e churn', () => {
    const pagamentos = [
      pag('a', '2026-01-05', '2026-02-28'), // jan+fev
      pag('b', '2026-01-03', '2026-01-31'), // só jan
      pag('b', '2026-03-02', '2026-03-31'), // volta em março
      pag('c', '2026-02-10', '2026-03-31'), // novo em fevereiro
    ]
    const base = baseClientesMensal(pagamentos, ['2026-01', '2026-02', '2026-03'])
    expect(base[0]).toMatchObject({ ativos: 2, novos: 2, perdidos: 0, churn: null })
    expect(base[1]).toMatchObject({ ativos: 2, novos: 1, perdidos: 1, churn: 0.5 })
    expect(base[2]).toMatchObject({ ativos: 2, novos: 0, perdidos: 1, reativados: 1, churn: 0.5 })
  })
})

describe('estatística e tendência', () => {
  it('estatísticas descritivas', () => {
    const e = estatisticas([10, 20, 30, 40])
    expect(e.media).toBe(25)
    expect(e.mediana).toBe(25)
    expect(e.min).toBe(10)
    expect(e.max).toBe(40)
    expect(e.cv).toBeCloseTo(Math.sqrt(125) / 25)
  })

  it('regressão linear e média móvel', () => {
    const r = regressaoLinear([10, 12, 14, 16])
    expect(r.declive).toBeCloseTo(2)
    expect(r.intercecao).toBeCloseTo(10)
    expect(r.r2).toBeCloseTo(1)
    expect(mediaMovel([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3])
  })

  it('sazonalidade e projeção', () => {
    const serie = mesesEntre('2024-01-01', '2025-12-01').map((mes) => ({
      mes,
      receita: Number(mes.slice(5, 7)) === 8 ? 50 : 100,
    }))
    const idx = indicesSazonais(serie)
    expect(idx[7]).toBeLessThan(1)
    expect(idx[0]).toBeGreaterThan(1)
    const proj = projetarReceita(serie, 12, idx)
    expect(proj).toHaveLength(12)
    expect(proj[0].mes).toBe('2026-01')
    expect(proj[7].receita).toBeCloseTo(50, 0)
    expect(proj[0].receita).toBeCloseTo(100, 0)
  })

  it('CAGR', () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1)
    expect(cagr(0, 100, 2)).toBeNull()
  })
})

describe('mrrNormalizado', () => {
  it('divide pagamentos de vários meses e ignora extras quando há mensalidade', async () => {
    const { mrrNormalizado } = await import('./analiseFinanceira')
    const r = mrrNormalizado(
      [
        pag('a', '2026-11-03', '2026-11-30', 60),
        pag('a', '2026-11-03', '2026-11-03', 20), // seguro
        pag('b', '2026-10-01', '2026-12-31', 270), // trimestral
        pag('c', '2026-10-28', '2026-11-30', 55), // pagou adiantado
        pag('d', '2026-09-01', '2026-09-30', 60), // já não está coberto
      ],
      '2026-11-14'
    )
    expect(r.cobertos).toBe(3)
    expect(r.mrr).toBe(60 + 90 + 55)
  })
})

describe('formatarValor', () => {
  it('formata euros, compactos e percentagens', async () => {
    const { formatarValor } = await import('./analiseFinanceira')
    expect(formatarValor(9480, 'eur')).toBe('€9\u202f480')
    expect(formatarValor(-1234567, 'eur')).toBe('−€1\u202f234\u202f567')
    expect(formatarValor(12500, 'eur', true)).toBe('€12,5k')
    expect(formatarValor(0.123, 'pct')).toBe('12,3%')
  })
})

describe('receitas sem cliente', () => {
  it('contam para a receita mas não para clientes, pagamentos nem planos', async () => {
    const { resumirPeriodo, receitaMensal, normalizarMetodo } = await import('./analiseFinanceira')
    const lista = [
      pag('a', '2026-01-05', '2026-01-31', 60),
      pag('', '2026-01-10', '2026-01-10', 40, { outra: 'Osteopatia', metodo: 'numerário' }),
      pag('', '2026-01-01', '2026-01-01', -10, { outra: 'Ajuste', metodo: null }),
    ]
    const r = resumirPeriodo(lista, '2026-01-01', '2026-01-31')
    expect(r.receita).toBe(90)
    expect(r.receitaClientes).toBe(60)
    expect(r.receitaOutras).toBe(30)
    expect(r.pagamentos).toBe(1)
    expect(r.clientesPagantes).toBe(1)
    expect(r.ticketMedio).toBe(60)
    expect(r.porOutras.get('Osteopatia')).toBe(40)
    expect(r.porMetodo.get('Numerário')).toBe(40)
    expect([...r.porPlano.values()]).toEqual([60])
    const m = receitaMensal(lista, ['2026-01'])
    expect(m.total).toEqual([90])
    expect(m.pagamentos).toEqual([1])
    expect(normalizarMetodo('MB WAY')).toBe('MB Way')
    expect(normalizarMetodo('Transferência bancária')).toBe('Transferência')
    expect(normalizarMetodo('TPA')).toBe('Multibanco')
  })
})
