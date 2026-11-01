import { describe, expect, it } from 'vitest'
import { dataDeHojeEmLisboa } from './aniversariosSms'

describe('dataDeHojeEmLisboa', () => {
  it('usa a data de Lisboa, não a data UTC', () => {
    // 23:30 UTC de 14 de junho já é 00:30 de 15 de junho em Lisboa
    // (verão, UTC+1).
    const data = new Date('2026-06-14T23:30:00Z')
    expect(dataDeHojeEmLisboa(data)).toBe('2026-06-15')
  })

  it('bate certo com a data UTC fora da janela de viragem', () => {
    const data = new Date('2026-06-14T12:00:00Z')
    expect(dataDeHojeEmLisboa(data)).toBe('2026-06-14')
  })
})
