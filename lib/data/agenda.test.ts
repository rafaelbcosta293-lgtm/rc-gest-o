import { describe, expect, it } from 'vitest'
import { gerarOcorrencias, corTipoEvento } from './agenda'

describe('gerarOcorrencias', () => {
  it('sem repetição devolve só a data inicial', () => {
    expect(gerarOcorrencias('2026-03-02', 'nao', { modo: 'vezes', vezes: 5 })).toEqual(['2026-03-02'])
  })

  it('semanal, N vezes, gera datas de 7 em 7 dias', () => {
    expect(gerarOcorrencias('2026-03-02', 'semanal', { modo: 'vezes', vezes: 3 })).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ])
  })

  it('quinzenal, N vezes, gera datas de 14 em 14 dias', () => {
    expect(gerarOcorrencias('2026-03-02', 'quinzenal', { modo: 'vezes', vezes: 3 })).toEqual([
      '2026-03-02',
      '2026-03-16',
      '2026-03-30',
    ])
  })

  it('semanal "até" inclui a data limite quando cai exatamente num passo', () => {
    expect(gerarOcorrencias('2026-03-02', 'semanal', { modo: 'ate', ate: '2026-03-16' })).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ])
  })

  it('nunca gera mais do que o limite de segurança (52), mesmo pedindo muito mais', () => {
    expect(gerarOcorrencias('2026-01-01', 'semanal', { modo: 'vezes', vezes: 500 })).toHaveLength(52)
  })

  it('"vezes" nunca gera menos de 1 ocorrência mesmo com um valor inválido', () => {
    expect(gerarOcorrencias('2026-03-02', 'semanal', { modo: 'vezes', vezes: 0 })).toEqual(['2026-03-02'])
  })
})

describe('corTipoEvento', () => {
  it('devolve uma cor diferente por tipo de evento', () => {
    const cores = new Set(
      (['Treino', 'Avaliação', 'Reunião', 'Outro'] as const).map((t) => corTipoEvento(t).tx)
    )
    expect(cores.size).toBe(4)
  })
})
