import { describe, expect, it } from 'vitest'
import {
  calcularResumoMes,
  diasUteisDoMes,
  ehDiaUtil,
  erroTurnos,
  fechoDisponivel,
  formatarHoras,
  horasDoDia,
  hojeLisboa,
  intervaloDias,
  motivoBloqueioFerias,
} from './assiduidade'

describe('dias úteis', () => {
  it('exclui fins de semana e feriados nacionais', () => {
    expect(ehDiaUtil('2026-11-14', 'fatima')).toBe(false) // sábado
    expect(ehDiaUtil('2026-12-08', 'fatima')).toBe(false) // Imaculada Conceição
    expect(ehDiaUtil('2026-11-16', 'fatima')).toBe(true)
  })

  it('aplica o feriado municipal de cada estúdio', () => {
    // 22/05/2026 é sexta: feriado só em Leiria
    expect(ehDiaUtil('2026-05-22', 'leiria')).toBe(false)
    expect(ehDiaUtil('2026-05-22', 'fatima')).toBe(true)
    // 20/06/2025 é sexta: feriado só em Fátima (Ourém)
    expect(ehDiaUtil('2025-06-20', 'fatima')).toBe(false)
    expect(ehDiaUtil('2025-06-20', 'leiria')).toBe(true)
  })

  it('conta os dias úteis de um mês', () => {
    // novembro 2026: 21 dias seg-sex, menos nenhum feriado em dia útil (1/11 é domingo)
    expect(diasUteisDoMes(2026, 11, 'fatima')).toHaveLength(21)
  })
})

describe('turnos', () => {
  it('soma os dois turnos', () => {
    expect(horasDoDia({ entrada_1: '07:00', saida_1: '12:30', entrada_2: '16:00', saida_2: '19:00' })).toBe(8.5)
  })

  it('valida pares e ordem', () => {
    expect(erroTurnos({ entrada_1: '09:00', saida_1: null, entrada_2: null, saida_2: null })).toMatch(/entrada e a saída/)
    expect(erroTurnos({ entrada_1: '12:00', saida_1: '09:00', entrada_2: null, saida_2: null })).toMatch(/depois da entrada/)
    expect(erroTurnos({ entrada_1: '09:00', saida_1: '13:00', entrada_2: '12:00', saida_2: '18:00' })).toMatch(/2\.º turno/)
    expect(erroTurnos({ entrada_1: null, saida_1: null, entrada_2: null, saida_2: null })).toMatch(/pelo menos/)
    expect(erroTurnos({ entrada_1: '09:00', saida_1: '13:00', entrada_2: '14:00', saida_2: '18:00' })).toBeNull()
  })
})

describe('formatarHoras', () => {
  it('formata horas e saldo com sinal', () => {
    expect(formatarHoras(6.5)).toBe('6h30')
    expect(formatarHoras(6.5, true)).toBe('+6h30')
    expect(formatarHoras(-2.25, true)).toBe('-2h15')
    expect(formatarHoras(0, true)).toBe('0h00')
  })
})

describe('calcularResumoMes', () => {
  it('desconta férias à meta e soma sábados só às horas', () => {
    // novembro 2026 em Fátima: 21 dias úteis
    const registos = [
      { data: '2026-11-02', horas: 8 },
      { data: '2026-11-03', horas: 9 },
      { data: '2026-11-07', horas: 4 }, // sábado: só conta nas horas
    ]
    const r = calcularResumoMes({
      ano: 2026,
      mes: 11,
      slug: 'fatima',
      horasDiarias: 8,
      registos,
      diasFerias: ['2026-11-04', '2026-11-05', '2026-11-07'],
    })
    expect(r.diasUteis).toBe(21)
    expect(r.diasTrabalhados).toBe(2)
    expect(r.diasFerias).toEqual(['2026-11-04', '2026-11-05']) // o sábado não conta como férias
    expect(r.horasEsperadas).toBe(19 * 8)
    expect(r.horasRealizadas).toBe(21)
    expect(r.faltas).toBe(17)
    expect(r.saldo).toBe(21 - 152)
    expect(r.horasExtra).toBe(0)
  })

  it('exemplo do enunciado: 20 úteis − 2 férias = 144h esperadas, com horas extra', () => {
    // fevereiro 2027 em Leiria: 20 dias úteis
    const uteis = diasUteisDoMes(2027, 2, 'leiria')
    expect(uteis).toHaveLength(20)
    const ferias = uteis.slice(0, 2)
    const registos = uteis.slice(2).map((d) => ({ data: d, horas: 8.5 }))
    const r = calcularResumoMes({ ano: 2027, mes: 2, slug: 'leiria', horasDiarias: 8, registos, diasFerias: ferias })
    expect(r.horasEsperadas).toBe(144)
    expect(r.horasRealizadas).toBe(153)
    expect(r.horasExtra).toBe(9)
    expect(r.faltas).toBe(0)
  })

  it('lista os dias úteis sem registo até à data indicada', () => {
    const r = calcularResumoMes({
      ano: 2026,
      mes: 11,
      slug: 'fatima',
      horasDiarias: 8,
      registos: [{ data: '2026-11-02', horas: 8 }],
      diasFerias: ['2026-11-03'],
      ateDia: '2026-11-05',
    })
    expect(r.diasSemRegisto).toEqual(['2026-11-04', '2026-11-05'])
  })
})

describe('fechoDisponivel', () => {
  it('abre a partir do dia 25 e fica aberto para meses passados', () => {
    expect(fechoDisponivel('2026-11-24', 2026, 11)).toBe(false)
    expect(fechoDisponivel('2026-11-25', 2026, 11)).toBe(true)
    expect(fechoDisponivel('2026-12-03', 2026, 11)).toBe(true)
    expect(fechoDisponivel('2026-11-30', 2026, 12)).toBe(false)
  })
})

describe('motivoBloqueioFerias', () => {
  const base = { slug: 'fatima', estudioId: 1, bloqueios: [], outrosDeFerias: new Map<string, number>(), limiteSimultaneo: null }

  it('bloqueia fins de semana, feriados, períodos interditos e o limite em simultâneo', () => {
    expect(motivoBloqueioFerias('2026-11-14', base)).toBe('Fim de semana')
    expect(motivoBloqueioFerias('2026-12-08', base)).toBe('Imaculada Conceição')
    const bloqueios = [{ inicio: '2027-05-15', fim: '2027-06-30', estudio_id: null, motivo: 'Período de pico' }]
    expect(motivoBloqueioFerias('2027-06-01', { ...base, bloqueios })).toBe('Período de pico')
    const soLeiria = [{ inicio: '2027-05-15', fim: '2027-06-30', estudio_id: 2, motivo: 'Pico Leiria' }]
    expect(motivoBloqueioFerias('2027-06-01', { ...base, bloqueios: soLeiria })).toBeNull()
    const ocupados = new Map([['2027-08-10', 1]])
    expect(motivoBloqueioFerias('2027-08-10', { ...base, outrosDeFerias: ocupados, limiteSimultaneo: 1 })).toMatch(/Limite de 1 instrutor/)
    expect(motivoBloqueioFerias('2027-08-10', { ...base, outrosDeFerias: ocupados, limiteSimultaneo: 2 })).toBeNull()
  })
})

describe('utilitários', () => {
  it('hoje em Portugal e intervalo de dias', () => {
    expect(hojeLisboa(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02')
    expect(intervaloDias(['2027-08-12', '2027-08-10'])).toBe('10/08 a 12/08')
    expect(intervaloDias(['2027-08-10'])).toBe('10/08')
  })
})
