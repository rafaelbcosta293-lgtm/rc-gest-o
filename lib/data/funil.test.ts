import { describe, expect, it } from 'vitest'
import { calcularMetricasFunil, type HistoricoEtapaLinha } from './funil'

const ORDEM = ['Nova', 'Contactada', 'Experimental agendada', 'Experimental realizada', 'Falhou a experimental', 'Ganha', 'Perdida'] as const

function linha(partial: Partial<HistoricoEtapaLinha>): HistoricoEtapaLinha {
  return {
    lead_id: 'l1',
    estado_anterior: null,
    estado_novo: 'Nova',
    criado_em: '2026-03-01T10:00:00Z',
    ...partial,
  }
}

describe('calcularMetricasFunil', () => {
  it('conta, por etapa, quantos leads do escopo alguma vez a alcançaram', () => {
    const historico: HistoricoEtapaLinha[] = [
      linha({ lead_id: 'l1', estado_anterior: null, estado_novo: 'Nova' }),
      linha({ lead_id: 'l1', estado_anterior: 'Nova', estado_novo: 'Contactada' }),
      linha({ lead_id: 'l2', estado_anterior: null, estado_novo: 'Nova' }),
    ]
    const m = calcularMetricasFunil(['l1', 'l2'], historico, ORDEM)
    expect(m.porEtapa['Nova']).toBe(2)
    expect(m.porEtapa['Contactada']).toBe(1)
    expect(m.porEtapa['Ganha']).toBe(0)
  })

  it('ignora leads fora do escopo (leadIds)', () => {
    const historico: HistoricoEtapaLinha[] = [
      linha({ lead_id: 'l1', estado_novo: 'Nova' }),
      linha({ lead_id: 'fora-do-escopo', estado_novo: 'Ganha' }),
    ]
    const m = calcularMetricasFunil(['l1'], historico, ORDEM)
    expect(m.porEtapa['Ganha']).toBe(0)
  })

  it('taxaConversao é Ganha / total, 0 quando não há leads', () => {
    const historico: HistoricoEtapaLinha[] = [
      linha({ lead_id: 'l1', estado_novo: 'Nova' }),
      linha({ lead_id: 'l1', estado_anterior: 'Nova', estado_novo: 'Ganha' }),
      linha({ lead_id: 'l2', estado_novo: 'Nova' }),
    ]
    const m = calcularMetricasFunil(['l1', 'l2'], historico, ORDEM)
    expect(m.taxaConversao).toBe(0.5)
    expect(calcularMetricasFunil([], [], ORDEM).taxaConversao).toBe(0)
  })

  it('horasMediasPrimeiroContacto mede o tempo entre a criação e a primeira saída de "Nova"', () => {
    const historico: HistoricoEtapaLinha[] = [
      linha({ lead_id: 'l1', estado_anterior: null, estado_novo: 'Nova', criado_em: '2026-03-01T10:00:00Z' }),
      linha({ lead_id: 'l1', estado_anterior: 'Nova', estado_novo: 'Contactada', criado_em: '2026-03-01T12:00:00Z' }),
    ]
    const m = calcularMetricasFunil(['l1'], historico, ORDEM)
    expect(m.horasMediasPrimeiroContacto).toBe(2)
  })

  it('horasMediasPrimeiroContacto fica null quando nenhum lead saiu ainda de "Nova"', () => {
    const historico: HistoricoEtapaLinha[] = [linha({ lead_id: 'l1', estado_novo: 'Nova' })]
    const m = calcularMetricasFunil(['l1'], historico, ORDEM)
    expect(m.horasMediasPrimeiroContacto).toBeNull()
  })

  it('taxaComparecimento é realizadas / (agendadas + falhadas + realizadas), null sem nenhuma experimental', () => {
    const historico: HistoricoEtapaLinha[] = [
      linha({ lead_id: 'l1', estado_novo: 'Nova' }),
      linha({ lead_id: 'l1', estado_anterior: 'Nova', estado_novo: 'Experimental agendada' }),
      linha({ lead_id: 'l1', estado_anterior: 'Experimental agendada', estado_novo: 'Experimental realizada' }),
      linha({ lead_id: 'l2', estado_novo: 'Nova' }),
      linha({ lead_id: 'l2', estado_anterior: 'Nova', estado_novo: 'Experimental agendada' }),
      linha({ lead_id: 'l2', estado_anterior: 'Experimental agendada', estado_novo: 'Falhou a experimental' }),
      linha({ lead_id: 'l3', estado_novo: 'Nova' }),
    ]
    const m = calcularMetricasFunil(['l1', 'l2', 'l3'], historico, ORDEM)
    expect(m.taxaComparecimento).toBe(0.5)
    expect(calcularMetricasFunil(['l3'], [linha({ lead_id: 'l3', estado_novo: 'Nova' })], ORDEM).taxaComparecimento).toBeNull()
  })
})
