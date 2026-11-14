import { describe, expect, it } from 'vitest'
import { todasAsLinhas } from './todasAsLinhas'

function fonte(total: number) {
  const pedidos: [number, number][] = []
  const pedir = async (de: number, ate: number) => {
    pedidos.push([de, ate])
    const data = Array.from({ length: Math.max(0, Math.min(ate, total - 1) - de + 1) }, (_, i) => de + i)
    return { data, error: null }
  }
  return { pedir, pedidos }
}

describe('todasAsLinhas', () => {
  it('junta todas as páginas de 1000 até vir uma incompleta', async () => {
    const { pedir, pedidos } = fonte(2264)
    const { data, error } = await todasAsLinhas(pedir)
    expect(error).toBeNull()
    expect(data).toHaveLength(2264)
    expect(data[2263]).toBe(2263)
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('total múltiplo de 1000 faz só mais um pedido vazio', async () => {
    const { pedir, pedidos } = fonte(1000)
    const { data } = await todasAsLinhas(pedir)
    expect(data).toHaveLength(1000)
    expect(pedidos).toHaveLength(2)
  })

  it('devolve o erro do Supabase em vez de continuar', async () => {
    const { data, error } = await todasAsLinhas(async () => ({ data: null, error: { message: 'falhou' } }))
    expect(error?.message).toBe('falhou')
    expect(data).toEqual([])
  })

  it('em paralelo pede blocos de páginas e junta-as pela ordem certa', async () => {
    const { pedir, pedidos } = fonte(2264)
    const { data } = await todasAsLinhas(pedir, { emParalelo: 4 })
    expect(data).toHaveLength(2264)
    expect(data.slice(995, 1005)).toEqual([995, 996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004])
    expect(pedidos).toHaveLength(4)
  })
})
