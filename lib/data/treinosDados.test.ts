import { describe, expect, it } from 'vitest'
import { juntarTreinos, treinosEntre } from './treinosDados'

describe('treinos dados (histórico + Agenda)', () => {
  const historico = [
    { estudio_id: 1, data: '2026-10-17', treinos: 6 },
    { estudio_id: 1, data: '2026-10-31', treinos: 2 },
    { estudio_id: 2, data: '2026-10-30', treinos: 7 },
  ]
  const agenda = [
    { estudio_id: 1, data: '2026-10-17', id: 'a', grupo_id: null }, // dia do histórico: não conta
    { estudio_id: 1, data: '2026-11-03', id: 'b', grupo_id: null },
    { estudio_id: 1, data: '2026-11-03', id: 'c', grupo_id: 'g' },
    { estudio_id: 1, data: '2026-11-03', id: 'd', grupo_id: 'g' }, // dupla: conta uma vez
    { estudio_id: 1, data: '2026-11-20', id: 'e', grupo_id: null }, // futuro: não conta
    { estudio_id: 2, data: '2026-10-31', id: 'f', grupo_id: null }, // depois do histórico de Leiria: conta
  ]
  const t = juntarTreinos(historico, agenda, '2026-11-18')

  it('nunca conta o mesmo dia nas duas fontes; duplas uma vez; só os já dados', () => {
    expect(t.get(1)?.get('2026-10')).toBe(8)
    expect(t.get(1)?.get('2026-11')).toBe(2)
    expect(t.get(2)?.get('2026-10')).toBe(8)
  })

  it('soma por período e por estúdio', () => {
    expect(treinosEntre(t, '2026-10', '2026-11')).toBe(18)
    expect(treinosEntre(t, '2026-10', '2026-10', 2)).toBe(8)
    expect(treinosEntre(t, '2026-12', '2026-12')).toBe(0)
  })
})
