import { describe, expect, it } from 'vitest'
import { metricasNoIntervalo, type LeadMarketing } from './marketing'

function lead(partial: Partial<LeadMarketing>): LeadMarketing {
  return {
    estado: 'Nova',
    entrada: '2026-03-01',
    visita_data: null,
    visita_marcada_em: null,
    walk_in: false,
    ...partial,
  }
}

describe('metricasNoIntervalo', () => {
  it('conta leads só pela data de entrada, dentro do intervalo [início, fim[', () => {
    const leads = [
      lead({ entrada: '2026-03-01' }),
      lead({ entrada: '2026-03-31' }),
      lead({ entrada: '2026-04-01' }), // fora — é o fim exclusivo
      lead({ entrada: '2026-02-28' }), // fora — antes do início
    ]
    const m = metricasNoIntervalo(leads, '2026-03-01', '2026-04-01')
    expect(m.leads).toBe(2)
  })

  it('agendamentos conta por visita_marcada_em, não por entrada', () => {
    const leads = [
      lead({ entrada: '2026-02-01', visita_marcada_em: '2026-03-05' }),
      lead({ entrada: '2026-03-10', visita_marcada_em: null }),
    ]
    const m = metricasNoIntervalo(leads, '2026-03-01', '2026-04-01')
    expect(m.agendamentos).toBe(1)
  })

  it('fecho de visitas só conta leads "Ganha" que tiveram visita no intervalo', () => {
    const leads = [
      lead({ visita_data: '2026-03-05', estado: 'Ganha' }),
      lead({ visita_data: '2026-03-06', estado: 'Perdida' }),
      lead({ visita_data: null, estado: 'Ganha' }), // sem visita, não conta como fecho de visita
    ]
    const m = metricasNoIntervalo(leads, '2026-03-01', '2026-04-01')
    expect(m.visitas).toBe(2)
    expect(m.fechoVisitas).toBe(1)
  })

  it('walk-ins são leads walk_in=true entradas no intervalo, com o seu próprio fecho', () => {
    const leads = [
      lead({ entrada: '2026-03-02', walk_in: true, estado: 'Ganha' }),
      lead({ entrada: '2026-03-03', walk_in: true, estado: 'Nova' }),
      lead({ entrada: '2026-03-04', walk_in: false, estado: 'Ganha' }),
    ]
    const m = metricasNoIntervalo(leads, '2026-03-01', '2026-04-01')
    expect(m.walkIns).toBe(2)
    expect(m.fechoWalkIns).toBe(1)
  })

  it('totalFechos é sempre a soma de fechoVisitas e fechoWalkIns', () => {
    const leads = [
      lead({ visita_data: '2026-03-05', estado: 'Ganha' }),
      lead({ entrada: '2026-03-06', walk_in: true, estado: 'Ganha' }),
    ]
    const m = metricasNoIntervalo(leads, '2026-03-01', '2026-04-01')
    expect(m.totalFechos).toBe(m.fechoVisitas + m.fechoWalkIns)
    expect(m.totalFechos).toBe(2)
  })

  it('sem leads nenhumas, todas as métricas ficam a 0', () => {
    const m = metricasNoIntervalo([], '2026-03-01', '2026-04-01')
    expect(m).toEqual({
      leads: 0,
      agendamentos: 0,
      visitas: 0,
      fechoVisitas: 0,
      walkIns: 0,
      fechoWalkIns: 0,
      totalFechos: 0,
    })
  })
})
