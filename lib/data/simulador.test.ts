import { describe, expect, it } from 'vitest'
import { simular, type EntradasSimulador } from './simulador'

function entradas(partial: Partial<EntradasSimulador> = {}): EntradasSimulador {
  return {
    leadsPorMes: 100,
    taxaFecho: 0.1, // 10 clientes novos/mês
    churnMensal: 0.05,
    precoMedio: 50,
    margemBrutaPct: 0.7,
    nPts: 2,
    custoHoraPt: 8,
    horasPorPtPorMes: 80,
    custoMarketingMensal: 500,
    terceiroEstudio: false,
    custosFixosTerceiroEstudio: 0,
    ...partial,
  }
}

describe('simular', () => {
  it('novosClientesPorMes é leads × taxa de fecho', () => {
    expect(simular(entradas()).novosClientesPorMes).toBe(10)
  })

  it('clientesEstaveis é novos/churn (estado estável), null quando churn é 0', () => {
    expect(simular(entradas()).clientesEstaveis).toBe(200) // 10 / 0,05
    expect(simular(entradas({ churnMensal: 0 })).clientesEstaveis).toBeNull()
  })

  it('mrr fica null quando não há estado estável (sem clientesEstaveis)', () => {
    expect(simular(entradas({ churnMensal: 0 })).mrr).toBeNull()
  })

  it('custo total soma PTs + marketing, e só soma o 3º estúdio quando ativo', () => {
    const sem3 = simular(entradas()).custoTotalMensal
    const com3 = simular(entradas({ terceiroEstudio: true, custosFixosTerceiroEstudio: 1000 })).custoTotalMensal
    expect(com3 - sem3).toBe(1000)
    expect(sem3).toBe(2 * 8 * 80 + 500) // 1780
  })

  it('margem é mrr - custo total, e margemPct é margem/mrr', () => {
    const r = simular(entradas())
    expect(r.mrr).toBe(200 * 50) // 10000
    expect(r.margem).toBe(10000 - r.custoTotalMensal)
    expect(r.margemPct).toBeCloseTo(r.margem! / r.mrr!)
  })

  it('cac é custo de marketing / novos clientes por mês', () => {
    expect(simular(entradas()).cac).toBe(50) // 500 / 10
  })

  it('ltv é precoMedio × margemBrutaPct ÷ churn, null sem churn', () => {
    const r = simular(entradas())
    expect(r.ltv).toBeCloseTo((50 * 0.7) / 0.05) // 700
    expect(simular(entradas({ churnMensal: 0 })).ltv).toBeNull()
  })

  it('ratioLtvCac e mesesParaRecuperarCac derivam de ltv/cac de forma consistente', () => {
    const r = simular(entradas())
    expect(r.ratioLtvCac).toBeCloseTo(r.ltv! / r.cac!)
    expect(r.mesesParaRecuperarCac).toBeCloseTo(r.cac! / (50 * 0.7))
  })

  it('pontoDeEquilibrioClientes é custo total / preço médio', () => {
    const r = simular(entradas())
    expect(r.pontoDeEquilibrioClientes).toBeCloseTo(r.custoTotalMensal / 50)
  })
})
