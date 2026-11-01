import { describe, expect, it } from 'vitest'
import { emCrise } from './smsGateway'

describe('emCrise', () => {
  it('não considera crise com menos de 3 falhas consecutivas', () => {
    expect(emCrise({ tentativas_falhadas: 0, offline_desde: null })).toBe(false)
    expect(emCrise({ tentativas_falhadas: 2, offline_desde: '2026-10-31T10:00:00Z' })).toBe(false)
  })

  it('considera crise a partir de 3 falhas consecutivas', () => {
    expect(emCrise({ tentativas_falhadas: 3, offline_desde: '2026-10-31T10:00:00Z' })).toBe(true)
    expect(emCrise({ tentativas_falhadas: 5, offline_desde: '2026-10-31T10:00:00Z' })).toBe(true)
  })

  it('exige offline_desde preenchido, mesmo com tentativas suficientes', () => {
    expect(emCrise({ tentativas_falhadas: 3, offline_desde: null })).toBe(false)
  })
})
