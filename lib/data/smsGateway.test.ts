import { describe, expect, it } from 'vitest'
import { emCrise } from './smsGateway'

describe('emCrise', () => {
  it('sem falhas não há crise', () => {
    expect(emCrise({ tentativas_falhadas: 0, offline_desde: null })).toBe(false)
  })

  it('basta uma passagem falhada (que já tentou de novo sozinha)', () => {
    expect(emCrise({ tentativas_falhadas: 1, offline_desde: '2026-10-31T10:00:00Z' })).toBe(true)
    expect(emCrise({ tentativas_falhadas: 5, offline_desde: '2026-10-31T10:00:00Z' })).toBe(true)
  })

  it('exige offline_desde preenchido, mesmo com tentativas suficientes', () => {
    expect(emCrise({ tentativas_falhadas: 3, offline_desde: null })).toBe(false)
  })
})
