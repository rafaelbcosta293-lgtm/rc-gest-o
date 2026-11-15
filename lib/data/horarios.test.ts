import { describe, expect, it } from 'vitest'
import { BLOCOS_HORARIO } from './horarios'

describe('blocos da grelha de escalas', () => {
  it('cada bloco mostra-se como intervalo de meia hora, para a hora de fim nunca ficar implícita', () => {
    expect(BLOCOS_HORARIO[0]).toMatchObject({ hora: 7, minuto: 0, label: '07:00', intervalo: '07:00–07:30' })
    const das2030 = BLOCOS_HORARIO.find((b) => b.hora === 20 && b.minuto === 30)
    expect(das2030?.intervalo).toBe('20:30–21:00')
    for (const b of BLOCOS_HORARIO) {
      expect(b.intervalo.startsWith(`${b.label}–`)).toBe(true)
    }
  })
})
