import { describe, expect, it } from 'vitest'
import { mesesAtivo, dataRenovacaoSeguroEmDivida, segurosPorPagar } from './clientes'

describe('mesesAtivo', () => {
  it('null sem início de contrato', () => {
    expect(mesesAtivo(null, null)).toBeNull()
  })

  it('conta meses completos, não arredonda para cima', () => {
    // de 15/jan a 10/mar passaram-se só 1 mês completo (o dia 10 < 15)
    expect(mesesAtivo('2026-01-15', '2026-03-10')).toBe(1)
  })

  it('usa saiu_em como fim quando o cliente já saiu', () => {
    expect(mesesAtivo('2025-01-01', '2025-07-01')).toBe(6)
  })

  it('nunca devolve negativo', () => {
    expect(mesesAtivo('2026-01-01', '2026-01-01')).toBe(0)
  })
})

describe('dataRenovacaoSeguroEmDivida', () => {
  it('no próprio ano de inscrição não há dívida', () => {
    const hoje = new Date('2025-06-01T00:00:00')
    expect(dataRenovacaoSeguroEmDivida('2025-02-10', hoje)).toBeNull()
  })

  it('antes do mês de aniversário, o ciclo em dívida é o do ano passado', () => {
    // entrou em fevereiro/2025 → em janeiro/2026 ainda não chegou o
    // aniversário deste ano, mas já passou o de 2026-02... não, o
    // aniversário de 2026 é em fevereiro; em janeiro/2026 o ciclo mais
    // recente possível é fev/2025 (ainda o ano de inscrição) → sem dívida.
    const hoje = new Date('2026-01-15T00:00:00')
    expect(dataRenovacaoSeguroEmDivida('2025-02-10', hoje)).toBeNull()
  })

  it('a partir do mês de aniversário do ano seguinte, fica em dívida', () => {
    const hoje = new Date('2026-02-15T00:00:00')
    expect(dataRenovacaoSeguroEmDivida('2025-02-10', hoje)).toBe('2026-02-01')
  })

  it('a dívida mantém-se no mesmo ciclo mesmo bem depois do aniversário', () => {
    const hoje = new Date('2026-11-01T00:00:00')
    expect(dataRenovacaoSeguroEmDivida('2025-02-10', hoje)).toBe('2026-02-01')
  })
})

describe('segurosPorPagar', () => {
  const hoje = new Date('2026-06-01T00:00:00')

  it('cliente sem início de contrato é ignorado', () => {
    const r = segurosPorPagar([{ id: 'a', inicio_contrato: null }], hoje, [])
    expect(r).toHaveLength(0)
  })

  it('cliente no 1º ano de inscrição não aparece (ainda sem ciclo de dívida)', () => {
    const r = segurosPorPagar([{ id: 'a', inicio_contrato: '2026-01-10' }], hoje, [])
    expect(r).toHaveLength(0)
  })

  it('cliente com renovação em dívida e sem pagamento aparece na lista', () => {
    const r = segurosPorPagar([{ id: 'a', inicio_contrato: '2025-01-10' }], hoje, [])
    expect(r).toHaveLength(1)
    expect(r[0].dataRenovacao).toBe('2026-01-01')
  })

  it('um pagamento de seguro já feito, a partir da data de renovação, tira o cliente da lista', () => {
    const r = segurosPorPagar(
      [{ id: 'a', inicio_contrato: '2025-01-10' }],
      hoje,
      [{ cliente_id: 'a', data_pagamento: '2026-01-15' }]
    )
    expect(r).toHaveLength(0)
  })

  it('um pagamento anterior ao ciclo em dívida (de um ano antigo) não conta', () => {
    const r = segurosPorPagar(
      [{ id: 'a', inicio_contrato: '2025-01-10' }],
      hoje,
      [{ cliente_id: 'a', data_pagamento: '2025-02-01' }]
    )
    expect(r).toHaveLength(1)
  })

  it('uma reativação dentro do mesmo ano não reinicia a âncora do seguro', () => {
    // entrou jan/2024, saiu, reativou em nov/2024 (ainda dentro do 1º
    // ano) → a âncora continua jan/2024, fica em dívida a partir de
    // jan/2025, não de nov/2025.
    const r = segurosPorPagar(
      [{ id: 'a', inicio_contrato: '2024-01-01' }],
      new Date('2025-02-01T00:00:00'),
      [],
      [{ cliente_id: 'a', data_pagamento: '2024-11-01' }]
    )
    expect(r).toHaveLength(1)
    expect(r[0].dataRenovacao).toBe('2025-01-01')
  })

  it('uma reativação depois do seguro já ter caducado reinicia a âncora', () => {
    // entrou jan/2024, saiu, reativou em mar/2025 (já tinha passado 1
    // ano desde jan/2024) → a âncora passa a mar/2025, só fica em
    // dívida a partir de mar/2026.
    const r = segurosPorPagar(
      [{ id: 'a', inicio_contrato: '2024-01-01' }],
      new Date('2026-04-01T00:00:00'),
      [],
      [{ cliente_id: 'a', data_pagamento: '2025-03-01' }]
    )
    expect(r).toHaveLength(1)
    expect(r[0].dataRenovacao).toBe('2026-03-01')
  })
})
