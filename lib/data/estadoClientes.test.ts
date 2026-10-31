import { describe, expect, it } from 'vitest'
import { calcularTransicaoAutomatica, type ClienteParaEstadoAutomatico } from './estadoClientes'

function cliente(partial: Partial<ClienteParaEstadoAutomatico>): ClienteParaEstadoAutomatico {
  return {
    id: 'c1',
    estado: 'Ativo',
    estadoAutomatico: true,
    validoAte: '2026-01-01',
    ...partial,
  }
}

describe('calcularTransicaoAutomatica', () => {
  it('não muda nada enquanto o pagamento ainda está dentro do mês', () => {
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-02-10' }), '2026-02-20')).toBeNull()
  })

  it('passa a Suspenso a partir de 30 dias sem pagamento ativo', () => {
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-01-01' }), '2026-01-31')).toBe('Suspenso')
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-01-01' }), '2026-01-20')).toBeNull()
  })

  it('passa a Ex-cliente a partir de 60 dias sem pagamento ativo', () => {
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-01-01' }), '2026-03-02')).toBe('Ex-cliente')
  })

  it('vai direto para Ex-cliente mesmo que ainda estivesse Ativo (cron não correu há tempos)', () => {
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Ativo', validoAte: '2026-01-01' }), '2026-03-02')
    ).toBe('Ex-cliente')
  })

  it('nunca mexe num cliente já Ex-cliente', () => {
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Ex-cliente', validoAte: '2020-01-01' }), '2026-03-02')
    ).toBeNull()
  })

  it('não repete a mesma transição (já está Suspenso)', () => {
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Suspenso', validoAte: '2026-01-01' }), '2026-01-31')
    ).toBeNull()
  })

  it('nunca toca num cliente com estado alterado manualmente', () => {
    expect(
      calcularTransicaoAutomatica(
        cliente({ estadoAutomatico: false, validoAte: '2020-01-01' }),
        '2026-03-02'
      )
    ).toBeNull()
  })

  it('sem nenhum pagamento registado, não há como avaliar (ex.: clientes antigos sem histórico na app)', () => {
    expect(calcularTransicaoAutomatica(cliente({ validoAte: null }), '2026-03-02')).toBeNull()
  })
})
