import { afterEach, describe, expect, it, vi } from 'vitest'
import { enviarSms, prioridadePorOrdem } from './gateway'

describe('prioridadePorOrdem', () => {
  it('a primeira mensagem leva a prioridade normal mais alta e as seguintes descem uma a uma', () => {
    expect(prioridadePorOrdem(0)).toBe(99)
    expect(prioridadePorOrdem(1)).toBe(98)
    expect(prioridadePorOrdem(40)).toBe(59)
  })

  it('nunca passa de 99 (acima disso salta os limites) nem desce abaixo do mínimo', () => {
    expect(prioridadePorOrdem(-3)).toBe(99)
    expect(prioridadePorOrdem(227)).toBe(-128)
    expect(prioridadePorOrdem(1000)).toBe(-128)
  })
})

describe('enviarSms', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('manda a prioridade ao gateway só quando é pedida', async () => {
    vi.stubEnv('SMS_GATEWAY_URL_FATIMA', 'https://gw.exemplo')
    vi.stubEnv('SMS_GATEWAY_USERNAME_FATIMA', 'u')
    vi.stubEnv('SMS_GATEWAY_PASSWORD_FATIMA', 'p')
    const pedidos: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        pedidos.push(JSON.parse(init.body))
        return new Response('{}', { status: 202 })
      })
    )
    expect(await enviarSms('fatima', '912345678', 'Olá', { prioridade: 97 })).toEqual({ ok: true })
    expect(await enviarSms('fatima', '912345678', 'Olá')).toEqual({ ok: true })
    expect(pedidos).toEqual([
      { message: 'Olá', phoneNumbers: ['+351912345678'], priority: 97 },
      { message: 'Olá', phoneNumbers: ['+351912345678'] },
    ])
  })

  it('se o gateway recusar a prioridade, envia de novo sem ela', async () => {
    vi.stubEnv('SMS_GATEWAY_URL_FATIMA', 'https://gw.exemplo')
    vi.stubEnv('SMS_GATEWAY_USERNAME_FATIMA', 'u')
    vi.stubEnv('SMS_GATEWAY_PASSWORD_FATIMA', 'p')
    const pedidos: { priority?: number }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const corpo = JSON.parse(init.body)
        pedidos.push(corpo)
        return new Response('{}', { status: 'priority' in corpo ? 400 : 202 })
      })
    )
    expect(await enviarSms('fatima', '912345678', 'Olá', { prioridade: 99 })).toEqual({ ok: true })
    expect(pedidos.map((p) => 'priority' in p)).toEqual([true, false])
  })
})
