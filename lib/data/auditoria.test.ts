import { describe, expect, it } from 'vitest'
import { diferencasAuditoria } from './auditoria'

describe('diferencasAuditoria', () => {
  it('só devolve os campos cujo valor mudou', () => {
    const r = diferencasAuditoria({ valor: 50, metodo: 'Cartão' }, { valor: 60, metodo: 'Cartão' })
    expect(r).toEqual([{ campo: 'valor', de: 50, para: 60 }])
  })

  it('devolve [] para INSERT/DELETE (um dos lados é null)', () => {
    expect(diferencasAuditoria(null, { valor: 50 })).toEqual([])
    expect(diferencasAuditoria({ valor: 50 }, null)).toEqual([])
  })

  it('ignora criado_em/atualizado_em mesmo que mudem', () => {
    const r = diferencasAuditoria(
      { valor: 50, criado_em: '2026-01-01' },
      { valor: 50, criado_em: '2026-01-02' }
    )
    expect(r).toEqual([])
  })

  it('deteta um campo que só existe num dos lados', () => {
    const r = diferencasAuditoria({ valor: 50 }, { valor: 50, nota: 'ajuste' })
    expect(r).toEqual([{ campo: 'nota', de: undefined, para: 'ajuste' }])
  })
})
