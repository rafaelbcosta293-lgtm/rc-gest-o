import { describe, expect, it } from 'vitest'
import { fimDoMes, validadeSugerida } from './validadePagamento'

describe('fimDoMes', () => {
  it('último dia do próprio mês, incluindo meses de verão', () => {
    expect(fimDoMes('2026-06-10')).toBe('2026-06-30')
    expect(fimDoMes('2026-08-01')).toBe('2026-08-31')
  })

  it('fevereiro em ano bissexto e não bissexto', () => {
    expect(fimDoMes('2028-02-05')).toBe('2028-02-29')
    expect(fimDoMes('2026-02-05')).toBe('2026-02-28')
  })

  it('mês seguinte, incluindo a virada do ano', () => {
    expect(fimDoMes('2026-11-14', 1)).toBe('2026-12-31')
    expect(fimDoMes('2026-12-20', 1)).toBe('2027-01-31')
  })
})

describe('validadeSugerida', () => {
  it('sem o mês atual pago, cobre até ao fim deste mês', () => {
    expect(validadeSugerida('2026-11-05', '2026-10-31')).toBe('2026-11-30')
    expect(validadeSugerida('2026-11-05', null)).toBe('2026-11-30')
  })

  it('com o mês atual já pago, é o adiantado do mês seguinte', () => {
    expect(validadeSugerida('2026-11-26', '2026-11-30')).toBe('2026-12-31')
  })
})
