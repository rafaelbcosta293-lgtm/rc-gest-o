import { describe, expect, it } from 'vitest'
import { calcularCenario, leadsParaMeta, trajetoria, type Cenario } from './simulador'

const base: Cenario = {
  leadsMes: 100,
  taxaFecho: 0.1, // 10 novos/mês
  churn: 0.05, // estado estável: 200 clientes
  arpu: 100,
  horasPtPorCliente: 4,
  horasPorPt: 100,
  custoHoraPt: 10,
  custoPorLead: 5,
  custosFixos: 2000,
}

describe('calcularCenario', () => {
  it('liga leads → novos → clientes → MRR → PTs → custos', () => {
    const r = calcularCenario(base)
    expect(r.novosMes).toBe(10)
    expect(r.clientesEstaveis).toBe(200)
    expect(r.mrr).toBe(20000)
    expect(r.horasPtMes).toBe(800)
    expect(r.ptsNecessarios).toBe(8)
    expect(r.custoPt).toBe(8000)
    expect(r.custoMarketing).toBe(500)
    expect(r.custoTotal).toBe(10500)
    expect(r.margem).toBe(9500)
  })

  it('valor do cliente a partir da margem de contribuição', () => {
    const r = calcularCenario(base)
    expect(r.margemContribuicaoCliente).toBe(60) // 100 − 4h × €10
    expect(r.ltv).toBe(1200) // 60 / 0,05
    expect(r.cac).toBe(50) // 500 / 10
    expect(r.ratioLtvCac).toBe(24)
    expect(r.pontoEquilibrioClientes).toBeCloseTo(2500 / 60)
    expect(r.vidaMediaMeses).toBe(20)
  })

  it('churn 0 não tem estado estável', () => {
    expect(calcularCenario({ ...base, churn: 0 }).clientesEstaveis).toBeNull()
  })
})

describe('leadsParaMeta', () => {
  it('qualquer meta volta às leads necessárias com os mesmos rácios', () => {
    expect(leadsParaMeta('novosMes', 20, base)).toBe(200)
    expect(leadsParaMeta('clientes', 300, base)).toBeCloseTo(150)
    expect(leadsParaMeta('mrr', 30000, base)).toBeCloseTo(150)
    expect(leadsParaMeta('pts', 12, base)).toBeCloseTo(150)
    expect(leadsParaMeta('marketing', 1000, base)).toBe(200)
    expect(leadsParaMeta('novosMes', 5, { ...base, taxaFecho: 0 })).toBeNull()
  })

  it('a meta pedida é reproduzida pelo cenário resultante', () => {
    const leads = leadsParaMeta('clientes', 300, base)!
    expect(calcularCenario({ ...base, leadsMes: leads }).clientesEstaveis).toBeCloseTo(300)
  })
})

describe('trajetoria', () => {
  it('converge para o estado estável', () => {
    const t = trajetoria(100, base, 120)
    expect(t[0].clientes).toBeCloseTo(105) // 100 × 0,95 + 10
    expect(t[119].clientes).toBeCloseTo(200, 0)
  })
})
