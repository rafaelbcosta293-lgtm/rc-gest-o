import { describe, expect, it } from 'vitest'
import { gerarOcorrencias, gerarExtensaoSerie, corTipoEvento } from './agenda'

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

  it('"indefinido" gera a janela inicial (90 dias) a partir da data inicial, sem pedir data de fim', () => {
    const datas = gerarOcorrencias('2026-03-02', 'semanal', { modo: 'indefinido' })
    expect(datas[0]).toBe('2026-03-02')
    // 90 dias ÷ 7 ≈ 12 semanas, mais a primeira — sem ultrapassar o
    // limite de segurança nem a janela.
    expect(datas.length).toBeGreaterThan(10)
    expect(datas.length).toBeLessThanOrEqual(52)
    expect(datas[datas.length - 1] <= '2026-05-31').toBe(true) // 2026-03-02 + 90 dias
  })
})

describe('gerarExtensaoSerie', () => {
  it('sem nada para estender (última data já cobre o horizonte), devolve uma lista vazia', () => {
    expect(gerarExtensaoSerie('2026-06-01', 'semanal', '2026-03-02')).toEqual([])
  })

  it('estende a partir do próximo passo depois da última data gerada', () => {
    const datas = gerarExtensaoSerie('2026-03-02', 'semanal', '2026-03-02')
    expect(datas[0]).toBe('2026-03-09')
    expect(datas.every((d) => d > '2026-03-02')).toBe(true)
  })

  it('quinzenal estende de 14 em 14 dias', () => {
    const datas = gerarExtensaoSerie('2026-03-02', 'quinzenal', '2026-03-02')
    expect(datas[0]).toBe('2026-03-16')
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
