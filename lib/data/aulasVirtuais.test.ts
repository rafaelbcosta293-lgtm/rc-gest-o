import { describe, expect, it } from 'vitest'
import { agruparPorCategoria, duracaoPorExtenso, extrairIdYoutube, montarAulasVirtuaisApp, type AulaVirtual } from './aulasVirtuais'

describe('extrairIdYoutube', () => {
  it('aceita as várias formas de ligação do YouTube', () => {
    for (const t of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLx',
      'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abcDEF123',
      'youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share',
      '  dQw4w9WgXcQ  ',
    ]) {
      expect(extrairIdYoutube(t), t).toBe('dQw4w9WgXcQ')
    }
  })
  it('recusa o que não é um vídeo do YouTube', () => {
    for (const t of ['', null, 'olá', 'https://vimeo.com/123456789', 'https://www.youtube.com/', 'https://www.youtube.com/watch?v=curto', 'https://youtube.com.exemplo.pt/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/playlist?list=PLabcdefghij']) {
      expect(extrairIdYoutube(t), String(t)).toBeNull()
    }
  })
})

describe('duracaoPorExtenso', () => {
  it('minutos e horas', () => {
    expect(duracaoPorExtenso(45)).toBe('45 min')
    expect(duracaoPorExtenso(60)).toBe('1 h')
    expect(duracaoPorExtenso(75)).toBe('1 h 15')
    expect(duracaoPorExtenso(null)).toBeNull()
    expect(duracaoPorExtenso(0)).toBeNull()
  })
})

const aula = (p: Partial<AulaVirtual>): AulaVirtual => ({
  id: 'a',
  titulo: 'Aula',
  descricao: null,
  categoria: 'Pilates',
  nivel: null,
  duracao_min: 30,
  youtube_id: 'dQw4w9WgXcQ',
  publicada: true,
  ordem: 1,
  criado_em: '2026-11-25T10:00:00Z',
  ...p,
})

describe('agruparPorCategoria', () => {
  it('categorias pela ordem da primeira aula; aulas pela ordem dentro de cada uma', () => {
    const g = agruparPorCategoria([
      aula({ id: 'c', categoria: 'Pilates', ordem: 3 }),
      aula({ id: 'a', categoria: 'Mobilidade', ordem: 1 }),
      aula({ id: 'b', categoria: 'Pilates', ordem: 2 }),
      aula({ id: 'd', categoria: 'Mobilidade', ordem: 4 }),
    ])
    expect(g.map((x) => [x.categoria, x.aulas.map((a) => a.id).join('')])).toEqual([
      ['Mobilidade', 'ad'],
      ['Pilates', 'bc'],
    ])
  })
})

describe('montarAulasVirtuaisApp', () => {
  it('só as publicadas, renumeradas, sem dados internos', () => {
    const r = montarAulasVirtuaisApp([
      aula({ id: 'x', ordem: 5, publicada: false }),
      aula({ id: 'b', ordem: 9, categoria: 'Força' }),
      aula({ id: 'a', ordem: 2, descricao: 'Para começar', nivel: 'Iniciação' }),
    ])
    expect(r).toEqual([
      { id: 'a', titulo: 'Aula', descricao: 'Para começar', categoria: 'Pilates', nivel: 'Iniciação', duracao_min: 30, youtube_id: 'dQw4w9WgXcQ', ordem: 1 },
      { id: 'b', titulo: 'Aula', descricao: null, categoria: 'Força', nivel: null, duracao_min: 30, youtube_id: 'dQw4w9WgXcQ', ordem: 2 },
    ])
  })
})
