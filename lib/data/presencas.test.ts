import { describe, expect, it } from 'vitest'
import { treinosPrevistos, treinosNoPeriodo, intervaloMes, diasDoMes, offsetPrimeiroDia, fmt, iniciais } from './presencas'

describe('treinosPrevistos', () => {
  it('devolve null sem frequência semanal definida', () => {
    expect(treinosPrevistos(null, 2026, 3)).toBeNull()
  })

  it('calcula treinos previstos num mês de 31 dias (31/7 semanas)', () => {
    const r = treinosPrevistos(2, 2026, 3) // março 2026 tem 31 dias
    expect(r).not.toBeNull()
    expect(r!.semanas).toBeCloseTo(31 / 7, 5)
    expect(r!.exato).toBeCloseTo(2 * (31 / 7), 5)
    expect(r!.arredondado).toBe(Math.round(2 * (31 / 7)))
  })

  it('fevereiro (28 dias) dá menos treinos previstos do que março (31 dias), à mesma frequência', () => {
    const fev = treinosPrevistos(3, 2026, 2)!
    const mar = treinosPrevistos(3, 2026, 3)!
    expect(fev.exato).toBeLessThan(mar.exato)
  })
})

describe('treinosNoPeriodo', () => {
  it('devolve null sem frequência', () => {
    expect(treinosNoPeriodo(null, '2026-01-01', '2026-01-31')).toBeNull()
  })

  it('um período de exatamente 1 semana dá a própria frequência', () => {
    expect(treinosNoPeriodo(2, '2026-01-01', '2026-01-08')).toBe(2)
  })

  it('um período de 0 dias dá 0 treinos previstos', () => {
    expect(treinosNoPeriodo(3, '2026-01-01', '2026-01-01')).toBe(0)
  })
})

describe('intervaloMes', () => {
  it('devolve o próprio mês como início e o 1º dia do mês seguinte como fim exclusivo', () => {
    expect(intervaloMes(2026, 3)).toEqual({ inicio: '2026-03-01', fimExclusivo: '2026-04-01' })
  })

  it('dezembro vira para o ano seguinte', () => {
    expect(intervaloMes(2026, 12)).toEqual({ inicio: '2026-12-01', fimExclusivo: '2027-01-01' })
  })
})

describe('diasDoMes / offsetPrimeiroDia', () => {
  it('fevereiro de 2026 (não bissexto) tem 28 dias', () => {
    expect(diasDoMes(2026, 2)).toHaveLength(28)
  })

  it('fevereiro de 2028 (bissexto) tem 29 dias', () => {
    expect(diasDoMes(2028, 2)).toHaveLength(29)
  })

  it('offset conta dias a partir de segunda-feira (0 = segunda)', () => {
    // 1 de março de 2026 cai num domingo => offset 6 (segunda=0 ... domingo=6)
    expect(offsetPrimeiroDia(2026, 3)).toBe(6)
  })
})

describe('fmt / iniciais', () => {
  it('formata ISO em DD/MM/AAAA', () => {
    expect(fmt('2026-03-05')).toBe('05/03/2026')
  })

  it('devolve — para data nula', () => {
    expect(fmt(null)).toBe('—')
  })

  it('iniciais usa a primeira e a última palavra do nome', () => {
    expect(iniciais('Rafael Barros Costa')).toBe('RC')
  })

  it('iniciais com um nome só usa a primeira letra', () => {
    expect(iniciais('Rafael')).toBe('R')
  })
})
