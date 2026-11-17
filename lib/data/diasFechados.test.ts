import { describe, expect, it } from 'vitest'
import { mensagemDiaFechado } from './diasFechados'

describe('mensagemDiaFechado', () => {
  it('um dia', () => {
    expect(mensagemDiaFechado(['2026-12-08'])).toBe('O estúdio está fechado a 08/12/2026 — não se podem marcar treinos nesse dia.')
  })
  it('vários dias', () => {
    expect(mensagemDiaFechado(['2026-12-08', '2026-12-25', '2027-01-01'])).toBe(
      'O estúdio está fechado a 08/12/2026, 25/12/2026 e 01/01/2027 — não se podem marcar treinos nesses dias.'
    )
  })
  it('nenhum', () => {
    expect(mensagemDiaFechado([])).toBe('')
  })
})
