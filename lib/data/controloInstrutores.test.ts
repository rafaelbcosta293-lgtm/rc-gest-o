import { describe, expect, it } from 'vitest'
import {
  calcularAvaliacaoInstrutores,
  estadoDoPlano,
  exigeInstrutor,
  faltaInstrutor,
  INICIO_CONTROLO,
  instrutorHerdado,
  instanteEmLisboa,
  periodoDaAvaliacao,
  precisaDePlano,
  taxaDePlano,
  type EventoRelatorio,
  type PlanoRelatorio,
} from './controloInstrutores'

const treino = { tipo: 'Treino', estado: 'Agendado', data: '2026-12-02', pt_id: null, cliente_id: 'c1' }

describe('sinais na Agenda', () => {
  it('só os treinos exigem instrutor', () => {
    expect(exigeInstrutor('Treino')).toBe(true)
    expect(exigeInstrutor('Reunião')).toBe(false)
    expect(exigeInstrutor('Sessão experimental')).toBe(false)
  })
  it('o instrutor de um treino nunca passa para os outros da série', () => {
    expect(instrutorHerdado('Treino', 'p1')).toBeNull()
    expect(instrutorHerdado('Reunião', 'p1')).toBe('p1')
    expect(instrutorHerdado('Reunião', null)).toBeNull()
  })
  it('falta de instrutor: treino não desmarcado, a partir do início do controlo', () => {
    expect(faltaInstrutor(treino)).toBe(true)
    expect(faltaInstrutor({ ...treino, pt_id: 'p1' })).toBe(false)
    expect(faltaInstrutor({ ...treino, estado: 'Cancelado' })).toBe(false)
    expect(faltaInstrutor({ ...treino, tipo: 'Reunião' })).toBe(false)
    expect(faltaInstrutor({ ...treino, data: '2026-11-20' })).toBe(false)
    expect(faltaInstrutor({ ...treino, data: INICIO_CONTROLO })).toBe(true)
  })
  it('o plano só se cobra até amanhã, e só com cliente', () => {
    expect(precisaDePlano(treino, '2026-12-02')).toBe(true)
    expect(precisaDePlano(treino, '2026-12-01')).toBe(false)
    expect(precisaDePlano({ ...treino, cliente_id: null }, '2026-12-05')).toBe(false)
    expect(precisaDePlano({ ...treino, estado: 'Cancelado' }, '2026-12-05')).toBe(false)
    expect(precisaDePlano({ ...treino, data: '2026-11-26' }, '2026-12-05')).toBe(false)
  })
  it('plano sem exercícios não conta como feito', () => {
    expect(estadoDoPlano(undefined)).toBe('nenhum')
    expect(estadoDoPlano({ exercicios: 0 })).toBe('vazio')
    expect(estadoDoPlano({ exercicios: 4 })).toBe('feito')
  })
})

const ev = (id: string, extra: Partial<EventoRelatorio> = {}): EventoRelatorio => ({
  id,
  grupo_id: null,
  estudio_id: 1,
  cliente_id: 'c1',
  cliente_nome: 'Ana',
  pt_id: 'p1',
  data: '2026-12-02',
  hora_inicio: '09:00:00',
  ...extra,
})
const plano = (id: string, extra: Partial<PlanoRelatorio> = {}): PlanoRelatorio => ({
  id,
  agenda_evento_id: null,
  pt_id: 'p1',
  data: '2026-12-02',
  criado_em: '2026-12-01T18:00:00+00:00',
  exercicios: 5,
  registado: false,
  ...extra,
})
const equipa = [
  { id: 'p1', nome: 'Rita' },
  { id: 'p2', nome: 'Tiago' },
]

describe('calcularAvaliacaoInstrutores', () => {
  it('conta treinos dados, clientes e planos por instrutor', () => {
    const r = calcularAvaliacaoInstrutores(
      [
        ev('e1'),
        ev('e2', { data: '2026-12-04' }),
        ev('e3', { cliente_id: 'c2', cliente_nome: 'Bruno' }),
        ev('e4', { pt_id: 'p2', cliente_id: 'c2', cliente_nome: 'Bruno' }),
        ev('e5', { pt_id: null }),
      ],
      [
        plano('s1', { agenda_evento_id: 'e1', registado: true }),
        plano('s2', { agenda_evento_id: 'e3', exercicios: 0 }),
        plano('s3', { agenda_evento_id: 'e4', pt_id: 'p1' }),
      ],
      equipa
    )
    const rita = r.linhas.find((l) => l.ptId === 'p1')!
    expect(rita.treinos).toBe(3)
    expect(rita.comPlano).toBe(1)
    expect(rita.semPlano).toBe(2)
    expect(rita.registados).toBe(1)
    expect(taxaDePlano(rita)).toBeCloseTo(1 / 3)
    expect(rita.clientes).toEqual([
      { clienteId: 'c1', nome: 'Ana', treinos: 2, comPlano: 1 },
      { clienteId: 'c2', nome: 'Bruno', treinos: 1, comPlano: 0 },
    ])
    // Planos que a Rita fez: s1 e s3 (o s2 está vazio).
    expect(rita.planosFeitos).toBe(2)
    expect(rita.planosVazios).toBe(1)

    const tiago = r.linhas.find((l) => l.ptId === 'p2')!
    // O Tiago deu o treino e4, cujo plano foi feito pela Rita.
    expect(tiago.treinos).toBe(1)
    expect(tiago.comPlano).toBe(1)
    expect(tiago.planosFeitos).toBe(0)

    expect(r.treinosSemInstrutor).toBe(1)
    expect(r.totalTreinos).toBe(5)
    expect(r.totalComPlano).toBe(2)
  })

  it('treino em simultâneo conta uma vez como treino, mas pede um plano por cliente', () => {
    const r = calcularAvaliacaoInstrutores(
      [ev('e1', { grupo_id: 'g1' }), ev('e2', { grupo_id: 'g1', cliente_id: 'c2', cliente_nome: 'Bruno' })],
      [plano('s1', { agenda_evento_id: 'e1' })],
      equipa
    )
    const rita = r.linhas[0]
    expect(rita.treinos).toBe(1)
    expect(rita.treinosCliente).toBe(2)
    expect(rita.comPlano).toBe(1)
  })

  it('plano a tempo é o criado antes da hora do treino (hora de Lisboa)', () => {
    const r = calcularAvaliacaoInstrutores(
      [ev('e1'), ev('e2', { data: '2026-12-03' })],
      [
        // 08:30 em Lisboa (inverno = UTC), treino às 09:00 → a tempo.
        plano('s1', { agenda_evento_id: 'e1', criado_em: '2026-12-02T08:30:00+00:00' }),
        // Criado no dia seguinte ao treino → fora de tempo.
        plano('s2', { agenda_evento_id: 'e2', criado_em: '2026-12-04T10:00:00+00:00' }),
      ],
      equipa
    )
    const rita = r.linhas[0]
    expect(rita.planosFeitos).toBe(2)
    expect(rita.planosATempo).toBe(1)
  })

  it('planos soltos e sem autor ficam contados à parte; toda a equipa aparece', () => {
    const r = calcularAvaliacaoInstrutores([], [plano('s1'), plano('s2', { pt_id: null })], equipa)
    expect(r.planosSemTreino).toBe(2)
    expect(r.planosSemAutor).toBe(1)
    expect(r.linhas.map((l) => l.nome)).toEqual(['Rita', 'Tiago'])
    expect(taxaDePlano(r.linhas[1])).toBeNull()
  })

  it('instrutor que já não está na equipa continua a aparecer', () => {
    const r = calcularAvaliacaoInstrutores([ev('e1', { pt_id: 'px' })], [], equipa)
    expect(r.linhas[0]).toMatchObject({ ptId: 'px', treinos: 1 })
  })
})

describe('períodos', () => {
  it('instante em Lisboa (hora de verão)', () => {
    expect(instanteEmLisboa('2026-07-01T07:30:00+00:00')).toBe('2026-07-01 08:30')
  })
  it('trimestre', () => {
    expect(periodoDaAvaliacao('2026-11-26', 'trimestre')).toEqual({
      modo: 'trimestre',
      inicio: '2026-10-01',
      fimExclusivo: '2027-01-01',
      titulo: '4.º trimestre de 2026',
      anterior: '2026-07-01',
      seguinte: '2027-01-01',
    })
    expect(periodoDaAvaliacao('2027-02-10', 'trimestre').anterior).toBe('2026-10-01')
  })
  it('mês', () => {
    expect(periodoDaAvaliacao('2026-12-15', 'mes')).toMatchObject({
      inicio: '2026-12-01',
      fimExclusivo: '2027-01-01',
      titulo: 'dezembro de 2026',
      anterior: '2026-11-01',
      seguinte: '2027-01-01',
    })
  })
})
