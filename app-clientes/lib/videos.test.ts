import { describe, expect, it } from 'vitest'
import { ancora, capaDoVideo, duracaoPorExtenso, enderecoDoLeitor, porCategoria, relogioDoVideo, resumoDaAula } from './videos'

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
  it('a capa vem da app e não mostra o vídeo do YouTube', () => {
    expect(capaDoVideo('abc')).toBe('/videos/abc/capa')
    expect(capaDoVideo('abc', true)).toBe('/videos/abc/capa?grande')
  })
  it('o leitor abre sem os botões do YouTube e aceita os nossos comandos', () => {
    const u = new URL(enderecoDoLeitor('dQw4w9WgXcQ', 'https://app.exemplo.pt'))
    expect(u.origin + u.pathname).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ enablejsapi: '1', origin: 'https://app.exemplo.pt', controls: '0', fs: '0', disablekb: '1' })
  })
  it('relógio do leitor', () => {
    expect(relogioDoVideo(7.9)).toBe('0:07')
    expect(relogioDoVideo(750)).toBe('12:30')
    expect(relogioDoVideo(3725)).toBe('1:02:05')
    expect(relogioDoVideo(NaN)).toBe('0:00')
  })
  it('âncora da categoria', () => {
    expect(ancora('Força e Core')).toBe('forca-e-core')
    expect(ancora('!!!')).toBe('aulas')
  })
})
