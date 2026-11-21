import { describe, expect, it } from 'vitest'
import { agruparPorCliente } from './checkinSemMensalidade'

describe('aviso de check-in sem mensalidade em dia', () => {
  const ana = { id: 'a', nome: 'Ana Silva', nome_preferido: null }
  const rui = { id: 'r', nome: 'Rui Costa', nome_preferido: null }
  const t = [
    { criado_em: '2026-12-01T09:02:00Z', servico_id: 1, cliente: ana },
    { criado_em: '2026-12-01T09:03:00Z', servico_id: 1, cliente: ana },
    { criado_em: '2026-12-01T18:30:00Z', servico_id: 1, cliente: rui },
    { criado_em: '2026-11-30T18:30:00Z', servico_id: 1, cliente: rui }, // ontem
  ]
  it('agrupa por cliente, só hoje', () => {
    expect(agruparPorCliente(t, '2026-12-01', new Set())).toEqual([
      { clienteId: 'a', nome: 'Ana Silva', horas: ['09:02', '09:03'] },
      { clienteId: 'r', nome: 'Rui Costa', horas: ['18:30'] },
    ])
  })
  it('desaparece quando a mensalidade desse serviço é regularizada', () => {
    expect(agruparPorCliente(t, '2026-12-01', new Set(['a:1'])).map((x) => x.clienteId)).toEqual(['r'])
  })
})
