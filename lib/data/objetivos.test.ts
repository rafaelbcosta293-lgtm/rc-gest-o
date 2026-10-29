import { describe, expect, it } from 'vitest'
import { progressoFluxo, progressoStock, calcularFunilInverso, semaforoPorRatio } from './objetivos'

describe('semaforoPorRatio', () => {
  it('verde a 100% ou mais, âmbar a partir de 90%, vermelho abaixo', () => {
    expect(semaforoPorRatio(1)).toBe('verde')
    expect(semaforoPorRatio(1.2)).toBe('verde')
    expect(semaforoPorRatio(0.9)).toBe('ambar')
    expect(semaforoPorRatio(0.5)).toBe('vermelho')
  })
})

describe('progressoFluxo', () => {
  it('extrapola o ritmo atual linearmente até ao fim do mês', () => {
    // 10 ao dia 10, mês de 30 dias -> projeção = 30
    const r = progressoFluxo(10, 40, 10, 30)
    expect(r.projecaoFimDoMes).toBe(30)
  })

  it('ritmo diário necessário é o que falta a dividir pelos dias restantes', () => {
    const r = progressoFluxo(10, 40, 10, 30)
    // faltam 30, restam 20 dias
    expect(r.ritmoDiarioNecessario).toBe(1.5)
  })

  it('ritmo diário é 0 quando a meta já foi atingida e não há dias a mais', () => {
    const r = progressoFluxo(40, 40, 10, 30)
    expect(r.ritmoDiarioNecessario).toBe(0)
  })

  it('semáforo reflete a projeção face à meta, não o progresso de hoje', () => {
    const r = progressoFluxo(10, 40, 10, 30) // projeção=30, meta=40 -> 75%
    expect(r.semaforo).toBe('vermelho')
  })
})

describe('progressoStock', () => {
  it('compara diretamente atual vs meta, sem extrapolação', () => {
    expect(progressoStock(45, 50).semaforo).toBe('ambar')
    expect(progressoStock(50, 50).semaforo).toBe('verde')
  })
})

describe('calcularFunilInverso', () => {
  it('usa a taxa de conversão real para calcular quantas leads são precisas', () => {
    // 10 ganhas de 100 leads -> taxa 10%; quero 5 clientes -> 50 leads
    const funil = { total: 100, porEtapa: { Ganha: 10, 'Experimental agendada': 40 } }
    const r = calcularFunilInverso(5, funil, 150)
    expect(r.leadsNecessarias).toBe(50)
    // taxa de experimental = 40% -> 50 * 0.4 = 20
    expect(r.experimentaisNecessarias).toBe(20)
    // 150 contactos / 100 leads = 1,5 por lead -> 50 * 1,5 = 75
    expect(r.contactosNecessarios).toBe(75)
  })

  it('devolve null quando não há nenhuma conversão no histórico (divisão por zero evitada)', () => {
    const r = calcularFunilInverso(5, { total: 50, porEtapa: {} }, 20)
    expect(r.leadsNecessarias).toBeNull()
    expect(r.experimentaisNecessarias).toBeNull()
  })
})
