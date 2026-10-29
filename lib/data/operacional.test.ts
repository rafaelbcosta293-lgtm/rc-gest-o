import { describe, expect, it } from 'vitest'
import {
  ocupacaoPorPt,
  retencaoEAssiduidadePorPt,
  resumoReavaliacoes,
  coberturaChecklist,
} from './operacional'

describe('ocupacaoPorPt', () => {
  it('ocupação é horas realizadas / horas disponíveis (0,5h por slot de escala)', () => {
    const r = ocupacaoPorPt(
      [{ pt_id: 'pt1', horas: 8, treinos_40: 0, treinos_60: 0 }],
      Array.from({ length: 20 }, () => ({ pt_id: 'pt1' })), // 20 slots × 0,5h = 10h disponíveis
      [{ id: 'pt1', nome: 'Ana' }]
    )
    expect(r[0].horasDisponiveis).toBe(10)
    expect(r[0].ocupacao).toBe(0.8)
  })

  it('fica null (não 0%) quando não há nenhum slot de escala', () => {
    const r = ocupacaoPorPt([], [], [{ id: 'pt1', nome: 'Ana' }])
    expect(r[0].ocupacao).toBeNull()
  })

  it('nunca passa de 100%, mesmo com mais horas realizadas do que escala', () => {
    const r = ocupacaoPorPt(
      [{ pt_id: 'pt1', horas: 20, treinos_40: 0, treinos_60: 0 }],
      [{ pt_id: 'pt1' }, { pt_id: 'pt1' }],
      [{ id: 'pt1', nome: 'Ana' }]
    )
    expect(r[0].ocupacao).toBe(1)
  })
})

describe('retencaoEAssiduidadePorPt', () => {
  it('ignora clientes sem pt_principal_id, e PTs sem clientes não aparecem', () => {
    const r = retencaoEAssiduidadePorPt(
      [{ id: 'c1', pt_principal_id: null, estado: 'Ativo', frequencia_semanal: 2 }],
      new Map(),
      2026,
      3,
      [{ id: 'pt1', nome: 'Ana' }]
    )
    expect(r).toHaveLength(0)
  })

  it('retenção é ativos / total de clientes do PT', () => {
    const r = retencaoEAssiduidadePorPt(
      [
        { id: 'c1', pt_principal_id: 'pt1', estado: 'Ativo', frequencia_semanal: 2 },
        { id: 'c2', pt_principal_id: 'pt1', estado: 'Ex-cliente', frequencia_semanal: 2 },
      ],
      new Map(),
      2026,
      3,
      [{ id: 'pt1', nome: 'Ana' }]
    )
    expect(r[0].totalClientes).toBe(2)
    expect(r[0].retencao).toBe(0.5)
  })

  it('assiduidade média só considera clientes ativos com frequência definida', () => {
    const presencas = new Map([['c1', [{ data: '2026-03-05', estado: 'Presente' }]]])
    const r = retencaoEAssiduidadePorPt(
      [{ id: 'c1', pt_principal_id: 'pt1', estado: 'Ativo', frequencia_semanal: 1 }],
      presencas,
      2026,
      3,
      [{ id: 'pt1', nome: 'Ana' }]
    )
    expect(r[0].assiduidadeMedia).not.toBeNull()
  })
})

describe('resumoReavaliacoes', () => {
  it('classifica cada data em atrasada ou a vencer, consoante a janela', () => {
    const r = resumoReavaliacoes(3, ['2026-03-01', '2026-03-10', null, '2026-04-01'], '2026-03-05', 14)
    expect(r.feitas).toBe(3)
    expect(r.atrasadas).toBe(1) // 2026-03-01 < hoje
    expect(r.aVencer).toBe(1) // 2026-03-10, dentro de 14 dias
  })
})

describe('coberturaChecklist', () => {
  it('conta quantos dias (dos esperados) já têm registo daquele tipo', () => {
    const registos = [
      { tipo: 'Abertura', data: '2026-03-01' },
      { tipo: 'Fecho', data: '2026-03-01' },
      { tipo: 'Abertura', data: '2026-03-02' },
    ]
    const dias = ['2026-03-01', '2026-03-02', '2026-03-03']
    expect(coberturaChecklist(registos, 'Abertura', dias)).toEqual({ submetidos: 2, esperados: 3 })
    expect(coberturaChecklist(registos, 'Fecho', dias)).toEqual({ submetidos: 1, esperados: 3 })
  })
})
