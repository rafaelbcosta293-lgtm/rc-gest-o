import { describe, expect, it } from 'vitest'
import { HORAS_MIN_MES, calcularCustoHora, ehHonorarioPt, escolherMes } from './custoHoraPt'

describe('custo por hora de PT', () => {
  it('só conta honorários dos PTs e prémios (não o salário do sócio nem encargos)', () => {
    expect(ehHonorarioPt('Honorários PT1 - Carolina Ribeiro')).toBe(true)
    expect(ehHonorarioPt('Prémios')).toBe(true)
    expect(ehHonorarioPt('Salário sócio')).toBe(false)
    expect(ehHonorarioPt('Seg. Social')).toBe(false)
    expect(ehHonorarioPt(null)).toBe(false)
  })
  it('honorários ÷ horas, a 2 casas; sem horas ou sem honorários fica por calcular', () => {
    expect(calcularCustoHora(3800, 377.9)).toBe(10.06)
    expect(calcularCustoHora(3800, 0)).toBeNull()
    expect(calcularCustoHora(0, 100)).toBeNull()
  })
  it('usa o último mês completo se já tinha a Agenda em uso; senão o mês a decorrer', () => {
    expect(escolherMes(new Map([['2026-11', 380]]), '2026-12', '2026-11')).toEqual({ mes: '2026-11', mesCorrente: false })
    expect(escolherMes(new Map([['2026-10', 2]]), '2026-11', '2026-10')).toEqual({ mes: '2026-11', mesCorrente: true })
    expect(escolherMes(new Map([['2026-10', HORAS_MIN_MES]]), '2026-11', '2026-10').mesCorrente).toBe(false)
  })
})
