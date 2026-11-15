import { describe, expect, it, vi } from 'vitest'
import { criarMemoria } from './memoria'

describe('criarMemoria', () => {
  it('reutiliza a resposta dentro da validade e só para a mesma chave', async () => {
    const memoria = criarMemoria<number>(1000)
    const carregar = vi.fn(async () => 7)
    expect(await memoria.obter('a', carregar)).toBe(7)
    expect(await memoria.obter('a', carregar)).toBe(7)
    expect(carregar).toHaveBeenCalledTimes(1)
    await memoria.obter('b', carregar)
    expect(carregar).toHaveBeenCalledTimes(2)
  })

  it('pedidos em simultâneo partilham a mesma ida à base de dados', async () => {
    const memoria = criarMemoria<number>(1000)
    const carregar = vi.fn(() => new Promise<number>((r) => setTimeout(() => r(1), 5)))
    await Promise.all([memoria.obter('a', carregar), memoria.obter('a', carregar), memoria.obter('a', carregar)])
    expect(carregar).toHaveBeenCalledTimes(1)
  })

  it('volta a perguntar depois de a validade passar', async () => {
    vi.useFakeTimers()
    try {
      const memoria = criarMemoria<number>(1000)
      const carregar = vi.fn(async () => 1)
      await memoria.obter('a', carregar)
      vi.advanceTimersByTime(1001)
      await memoria.obter('a', carregar)
      expect(carregar).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('sem chave (sem sessão) nunca guarda', async () => {
    const memoria = criarMemoria<number>(1000)
    const carregar = vi.fn(async () => 1)
    await memoria.obter(null, carregar)
    await memoria.obter(null, carregar)
    expect(carregar).toHaveBeenCalledTimes(2)
  })

  it('não guarda respostas recusadas nem falhas', async () => {
    const memoria = criarMemoria<number[]>(1000)
    const vazio = vi.fn(async () => [] as number[])
    await memoria.obter('a', vazio, (v) => v.length > 0)
    await Promise.resolve()
    await memoria.obter('a', vazio, (v) => v.length > 0)
    expect(vazio).toHaveBeenCalledTimes(2)

    const falha = vi.fn(async () => {
      throw new Error('sem rede')
    })
    await expect(memoria.obter('b', falha)).rejects.toThrow('sem rede')
    await expect(memoria.obter('b', falha)).rejects.toThrow('sem rede')
    expect(falha).toHaveBeenCalledTimes(2)
  })
})
