import { describe, expect, it } from 'vitest'
import { BLOCOS_HORARIO, slotDentroDaGrelha } from './horarios'

describe('blocos da grelha de escalas', () => {
  it('cada bloco mostra-se como intervalo de meia hora, para a hora de fim nunca ficar implícita', () => {
    expect(BLOCOS_HORARIO[0]).toMatchObject({ hora: 7, minuto: 0, label: '07:00', intervalo: '07:00–07:30' })
    const das2030 = BLOCOS_HORARIO.find((b) => b.hora === 20 && b.minuto === 30)
    expect(das2030?.intervalo).toBe('20:30–21:00')
    for (const b of BLOCOS_HORARIO) {
      expect(b.intervalo.startsWith(`${b.label}–`)).toBe(true)
    }
  })

  it('a grelha vai das 7:00 às 22:00: o último bloco é o das 21:30–22:00', () => {
    expect(BLOCOS_HORARIO.at(-1)?.intervalo).toBe('21:30–22:00')
    expect(BLOCOS_HORARIO).toHaveLength(30)
    expect(slotDentroDaGrelha('2026-11-17_21_0')).toBe(true)
    expect(slotDentroDaGrelha('2026-11-17_21_30')).toBe(true)
    expect(slotDentroDaGrelha('2026-11-17_22_0')).toBe(false)
    expect(slotDentroDaGrelha('2026-11-17_6_30')).toBe(false)
  })
})
