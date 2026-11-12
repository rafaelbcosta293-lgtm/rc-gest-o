import { describe, it, expect } from 'vitest'
import { domingoDePascoa, feriadosObrigatorios, feriadoDoDia, feriadosNoIntervalo } from './feriados'

describe('domingoDePascoa', () => {
  it('calcula datas conhecidas da Páscoa', () => {
    expect(domingoDePascoa(2024)).toBe('2024-03-31')
    expect(domingoDePascoa(2025)).toBe('2025-04-20')
    expect(domingoDePascoa(2026)).toBe('2026-04-05')
    expect(domingoDePascoa(2027)).toBe('2027-03-28')
  })
})

describe('feriadosObrigatorios', () => {
  it('tem os 13 feriados obrigatórios de 2026, incluindo os móveis', () => {
    const f = feriadosObrigatorios(2026)
    expect(f).toHaveLength(13)
    expect(f.map((x) => x.data)).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-05',
      '2026-04-25',
      '2026-05-01',
      '2026-06-04',
      '2026-06-10',
      '2026-08-15',
      '2026-10-05',
      '2026-11-01',
      '2026-12-01',
      '2026-12-08',
      '2026-12-25',
    ])
  })

  it('identifica o nome de cada feriado móvel', () => {
    const f = feriadosObrigatorios(2026)
    expect(f.find((x) => x.data === '2026-04-03')?.nome).toBe('Sexta-feira Santa')
    expect(f.find((x) => x.data === '2026-04-05')?.nome).toBe('Páscoa')
    expect(f.find((x) => x.data === '2026-06-04')?.nome).toBe('Corpo de Deus')
  })
})

describe('feriadoDoDia', () => {
  it('devolve o feriado de um dia específico, ou null', () => {
    expect(feriadoDoDia('2026-12-25')?.nome).toBe('Natal')
    expect(feriadoDoDia('2026-11-12')).toBeNull()
  })
})

describe('feriadosNoIntervalo', () => {
  it('encontra feriados dentro de um intervalo normal', () => {
    const f = feriadosNoIntervalo('2026-12-01', '2026-12-31')
    expect(f.map((x) => x.nome)).toEqual([
      'Restauração da Independência',
      'Imaculada Conceição',
      'Natal',
    ])
  })

  it('cobre a virada do ano', () => {
    const f = feriadosNoIntervalo('2026-12-29', '2027-01-05')
    expect(f).toEqual([{ data: '2027-01-01', nome: 'Ano Novo' }])
  })

  it('devolve lista vazia quando não há feriados no intervalo', () => {
    expect(feriadosNoIntervalo('2026-11-10', '2026-11-17')).toEqual([])
  })
})
