import { describe, expect, it } from 'vitest'
import { ancora, duracaoPorExtenso, porCategoria, resumoDaAula } from './videos'

describe('vídeos', () => {
  it('duração por extenso', () => {
    expect(duracaoPorExtenso(20)).toBe('20 min')
    expect(duracaoPorExtenso(60)).toBe('1 h')
    expect(duracaoPorExtenso(95)).toBe('1 h 35')
    expect(duracaoPorExtenso(null)).toBeNull()
  })
  it('resumo: nível e duração, o que houver', () => {
    expect(resumoDaAula({ nivel: 'Iniciação', duracao_min: 20 })).toBe('Iniciação · 20 min')
    expect(resumoDaAula({ nivel: null, duracao_min: 45 })).toBe('45 min')
    expect(resumoDaAula({ nivel: null, duracao_min: null })).toBe('')
  })
  it('agrupa por categoria, mantendo a ordem', () => {
    const g = porCategoria([
      { id: 1, categoria: 'Pilates' },
      { id: 2, categoria: 'Força' },
      { id: 3, categoria: 'Pilates' },
    ])
    expect(g.map((x) => [x.categoria, x.aulas.map((a) => a.id)])).toEqual([
      ['Pilates', [1, 3]],
      ['Força', [2]],
    ])
  })
  it('âncora da categoria', () => {
    expect(ancora('Força e Core')).toBe('forca-e-core')
    expect(ancora('!!!')).toBe('aulas')
  })
})
