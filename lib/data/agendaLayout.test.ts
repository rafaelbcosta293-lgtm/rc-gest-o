import { describe, expect, it } from 'vitest'
import { disporBlocos } from './agendaLayout'

const b = (id: string, inicio: number, fim: number, cancelado = false) => ({ id, inicio, fim, cancelado })
const pos = (lista: ReturnType<typeof disporBlocos>, id: string) => lista.find((p) => p.id === id)!

describe('disporBlocos', () => {
  it('um evento sozinho ocupa a largura toda', () => {
    expect(pos(disporBlocos([b('a', 420, 460)]), 'a')).toMatchObject({ coluna: 0, colunas: 1, largura: 1, recuo: 0 })
  })

  it('sobrepostos ficam lado a lado e alargam quando há espaço livre', () => {
    const r = disporBlocos([b('a', 420, 480), b('b', 420, 460), b('c', 440, 500), b('d', 480, 520)])
    expect(pos(r, 'a')).toMatchObject({ coluna: 0, colunas: 3, largura: 1 })
    expect(pos(r, 'b')).toMatchObject({ coluna: 1, colunas: 3, largura: 1 })
    expect(pos(r, 'c')).toMatchObject({ coluna: 2, colunas: 3, largura: 1 })
    // "d" começa quando "a" acaba: volta à coluna 0 e estende-se por
    // cima da coluna 1 (já livre) até bater em "c".
    expect(pos(r, 'd')).toMatchObject({ coluna: 0, colunas: 3, largura: 2 })
  })

  it('os desmarcados não ocupam coluna: ficam atrás e os ativos deixam uma aba à vista', () => {
    const r = disporBlocos([b('ativo', 600, 640), b('x', 600, 640, true), b('y', 620, 660, true), b('livre', 700, 740)])
    expect(pos(r, 'ativo')).toMatchObject({ coluna: 0, colunas: 1, largura: 1, recuo: 2 })
    expect(pos(r, 'x')).toMatchObject({ cancelado: true, nivel: 0, recuo: 0 })
    expect(pos(r, 'y')).toMatchObject({ cancelado: true, nivel: 1, recuo: 1 })
    expect(pos(r, 'livre').recuo).toBe(0)
    expect(pos(r, 'x').coberto).toBe(true)
    expect(pos(disporBlocos([b('z', 600, 640, true)]), 'z').coberto).toBe(false)
  })

  it('em escadinha: estende-se por baixo do vizinho que começa mais tarde', () => {
    const r = disporBlocos([b('a', 390, 445), b('b', 420, 480), b('c', 480, 520), b('d', 480, 520)])
    expect(pos(r, 'a').extra).toBeGreaterThan(0)
    expect(pos(r, 'b').extra).toBe(0)
    // Começam à mesma hora: lado a lado, sem se taparem.
    expect(pos(r, 'c').extra).toBe(0)
  })
})
