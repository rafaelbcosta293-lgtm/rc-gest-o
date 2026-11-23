import { describe, expect, it } from 'vitest'
import { aulasEmFalta, datasDoHorario, diaSemanaISO, fimDaJanelaDeAulas, ocupadas, type HorarioAula } from './aulas'

const horario = (o: Partial<HorarioAula> = {}): HorarioAula => ({
  id: 'h1',
  estudio_id: 1,
  servico_id: 3,
  dia_semana: 2, // terça
  hora_inicio: '19:00:00',
  duracao_min: 50,
  instrutor_id: null,
  lotacao: 5,
  ativo: true,
  desde: '2026-01-01',
  ate: null,
  ...o,
})

describe('diaSemanaISO', () => {
  it('segunda = 1 … domingo = 7', () => {
    expect(diaSemanaISO('2026-11-16')).toBe(1)
    expect(diaSemanaISO('2026-11-17')).toBe(2)
    expect(diaSemanaISO('2026-11-22')).toBe(7)
  })
})

describe('datasDoHorario', () => {
  it('todas as terças do intervalo', () => {
    expect(datasDoHorario(horario(), '2026-11-16', '2026-12-01')).toEqual(['2026-11-17', '2026-11-24', '2026-12-01'])
  })
  it('respeita o desde e o até do horário', () => {
    expect(datasDoHorario(horario({ desde: '2026-11-20', ate: '2026-11-30' }), '2026-11-16', '2026-12-31')).toEqual(['2026-11-24'])
  })
  it('intervalo vazio', () => {
    expect(datasDoHorario(horario({ ate: '2026-11-01' }), '2026-11-16', '2026-12-01')).toEqual([])
  })
})

describe('aulasEmFalta', () => {
  it('não repete as existentes, salta dias fechados e horários inativos', () => {
    const novas = aulasEmFalta(
      [horario(), horario({ id: 'h2', ativo: false })],
      [{ horario_id: 'h1', data: '2026-11-17' }],
      new Set(['2026-12-01']),
      '2026-11-16',
      '2026-12-01'
    )
    expect(novas.map((a) => a.data)).toEqual(['2026-11-24'])
    expect(novas[0]).toMatchObject({ horario_id: 'h1', servico_id: 3, lotacao: 5, hora_inicio: '19:00:00' })
  })
})

describe('ocupadas', () => {
  it('as canceladas libertam o lugar', () => {
    expect(ocupadas([{ estado: 'Inscrito' }, { estado: 'Presente' }, { estado: 'Faltou' }, { estado: 'Cancelada' }])).toBe(3)
  })
})

describe('fimDaJanelaDeAulas', () => {
  it('sem semana à vista (ou com uma próxima), são as 13 semanas', () => {
    expect(fimDaJanelaDeAulas('2026-11-23')).toBe('2027-02-21')
    expect(fimDaJanelaDeAulas('2026-11-23', '2026-12-27')).toBe('2027-02-21')
  })
  it('a ver uma semana mais distante, vai até ela', () => {
    expect(fimDaJanelaDeAulas('2026-11-23', '2027-03-21')).toBe('2027-03-21')
  })
  it('mas nunca mais de um ano', () => {
    expect(fimDaJanelaDeAulas('2026-11-23', '2029-01-01')).toBe('2027-11-21')
  })
})
