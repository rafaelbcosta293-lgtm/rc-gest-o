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
  it('não muda nada enquanto o pagamento ainda está em dia', () => {
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-02-10' }), '2026-02-10')).toBeNull()
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-02-10' }), '2026-02-09')).toBeNull()
  })

  it('passa a Pendente logo no primeiro dia sem pagamento válido', () => {
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-01-01' }), '2026-01-02')).toBe('Pendente')
  })

  it('não repete a mesma transição (já está Pendente)', () => {
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Pendente', validoAte: '2026-01-01' }), '2026-01-20')
    ).toBeNull()
  })

  it('passa a Inativo a partir de 60 dias sem pagamento válido', () => {
    expect(calcularTransicaoAutomatica(cliente({ validoAte: '2026-01-01' }), '2026-03-02')).toBe('Inativo')
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Pendente', validoAte: '2026-01-01' }), '2026-03-02')
    ).toBe('Inativo')
  })

  it('vai direto para Inativo mesmo que ainda estivesse Ativo (cron não correu há tempos)', () => {
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Ativo', validoAte: '2026-01-01' }), '2026-03-02')
    ).toBe('Inativo')
  })

  it('nunca mexe num cliente já Inativo', () => {
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Inativo', validoAte: '2020-01-01' }), '2026-03-02')
    ).toBeNull()
  })

  it('nunca mexe num cliente Suspenso — essa saída é sempre manual', () => {
    expect(
      calcularTransicaoAutomatica(cliente({ estado: 'Suspenso', validoAte: '2020-01-01' }), '2026-03-02')
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
