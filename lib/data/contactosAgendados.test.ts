import { describe, expect, it } from 'vitest'
import { avaliarContactoAgendado } from './contactosAgendados'

const AGORA = new Date('2026-11-10T15:00:00').getTime()

describe('avaliarContactoAgendado', () => {
  it('fica oculto a mais de 10 minutos da hora marcada', () => {
    expect(avaliarContactoAgendado({ data: '2026-11-10', hora: '15:11:00' }, AGORA).estado).toBe('oculto')
  })

  it('fica "próximo" a partir de 10 minutos antes da hora marcada', () => {
    expect(avaliarContactoAgendado({ data: '2026-11-10', hora: '15:10:00' }, AGORA).estado).toBe('próximo')
    expect(avaliarContactoAgendado({ data: '2026-11-10', hora: '15:01:00' }, AGORA).estado).toBe('próximo')
  })

  it('fica "atrasado" exatamente à hora marcada e depois', () => {
    expect(avaliarContactoAgendado({ data: '2026-11-10', hora: '15:00:00' }, AGORA).estado).toBe('atrasado')
    expect(avaliarContactoAgendado({ data: '2026-11-10', hora: '14:00:00' }, AGORA).estado).toBe('atrasado')
  })

  it('continua "atrasado" indefinidamente, não só nos minutos seguintes', () => {
    expect(avaliarContactoAgendado({ data: '2026-11-09', hora: '14:00:00' }, AGORA).estado).toBe('atrasado')
  })

  it('devolve os minutos restantes corretos', () => {
    expect(avaliarContactoAgendado({ data: '2026-11-10', hora: '15:05:00' }, AGORA).minutosRestantes).toBe(5)
    expect(avaliarContactoAgendado({ data: '2026-11-10', hora: '14:50:00' }, AGORA).minutosRestantes).toBe(-10)
  })
})
