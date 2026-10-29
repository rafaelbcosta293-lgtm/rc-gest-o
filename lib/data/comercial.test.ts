import { describe, expect, it } from 'vitest'
import {
  evolucaoSemanal,
  porOrigem,
  rankingComerciais,
  mapaDeCalorSemanaHora,
  type LeadParaRanking,
} from './comercial'

describe('evolucaoSemanal', () => {
  it('agrupa leads novas pela segunda-feira da semana de "entrada"', () => {
    // 2026-03-05 é uma quinta-feira; a semana começa em 2026-03-02.
    const pontos = evolucaoSemanal(
      [{ entrada: '2026-03-05' }, { entrada: '2026-03-02' }],
      [],
      2,
      '2026-03-05'
    )
    const semanaAtual = pontos[pontos.length - 1]
    expect(semanaAtual.semana).toBe('2026-03-02')
    expect(semanaAtual.novas).toBe(2)
  })

  it('conta experimentais/vendas a partir das transições, nunca dos dois ao mesmo tempo', () => {
    const transicoes = [
      { estado_novo: 'Experimental agendada', criado_em: '2026-03-05T10:00:00Z' },
      { estado_novo: 'Ganha', criado_em: '2026-03-05T11:00:00Z' },
      { estado_novo: 'Contactada', criado_em: '2026-03-05T12:00:00Z' },
    ]
    const pontos = evolucaoSemanal([], transicoes, 1, '2026-03-05')
    expect(pontos[0].experimentais).toBe(1)
    expect(pontos[0].vendas).toBe(1)
  })

  it('devolve exatamente "semanas" pontos, mesmo sem nenhum dado', () => {
    const pontos = evolucaoSemanal([], [], 8, '2026-03-05')
    expect(pontos).toHaveLength(8)
  })
})

describe('porOrigem', () => {
  it('agrupa por origem e calcula a taxa de conversão (ganhas/total)', () => {
    const r = porOrigem([
      { origem: 'Instagram', estado: 'Ganha' },
      { origem: 'Instagram', estado: 'Nova' },
      { origem: 'Indicação', estado: 'Ganha' },
    ])
    const instagram = r.find((o) => o.origem === 'Instagram')!
    expect(instagram.total).toBe(2)
    expect(instagram.ganhas).toBe(1)
    expect(instagram.taxaConversao).toBe(0.5)
  })

  it('agrupa origem vazia/null sob "Sem origem"', () => {
    const r = porOrigem([{ origem: null, estado: 'Nova' }, { origem: '  ', estado: 'Nova' }])
    expect(r).toHaveLength(1)
    expect(r[0].origem).toBe('Sem origem')
    expect(r[0].total).toBe(2)
  })

  it('ordena por volume total, descendente', () => {
    const r = porOrigem([
      { origem: 'A', estado: 'Nova' },
      { origem: 'B', estado: 'Nova' },
      { origem: 'B', estado: 'Nova' },
    ])
    expect(r[0].origem).toBe('B')
  })
})

describe('rankingComerciais', () => {
  function lead(partial: Partial<LeadParaRanking>): LeadParaRanking {
    return {
      responsavel_id: 'pt1',
      estado: 'Nova',
      visita_marcada_em: null,
      valor_potencial: null,
      contactos: 0,
      alcancouExperimentalRealizada: false,
      ...partial,
    }
  }

  it('ignora leads sem responsável, e comerciais sem nenhuma lead não aparecem', () => {
    const r = rankingComerciais(
      [lead({ responsavel_id: null })],
      [{ id: 'pt1', nome: 'Ana' }]
    )
    expect(r).toHaveLength(0)
  })

  it('showRate é realizadas/agendamentos, null sem nenhum agendamento', () => {
    const leads = [
      lead({ visita_marcada_em: '2026-03-01', alcancouExperimentalRealizada: true }),
      lead({ visita_marcada_em: '2026-03-02', alcancouExperimentalRealizada: false }),
    ]
    const r = rankingComerciais(leads, [{ id: 'pt1', nome: 'Ana' }])
    expect(r[0].agendamentos).toBe(2)
    expect(r[0].realizadas).toBe(1)
    expect(r[0].showRate).toBe(0.5)

    const semAgendamentos = rankingComerciais([lead({})], [{ id: 'pt1', nome: 'Ana' }])
    expect(semAgendamentos[0].showRate).toBeNull()
  })

  it('fechos e vendasValor só contam leads "Ganha"', () => {
    const leads = [
      lead({ estado: 'Ganha', valor_potencial: 50 }),
      lead({ estado: 'Perdida', valor_potencial: 999 }),
    ]
    const r = rankingComerciais(leads, [{ id: 'pt1', nome: 'Ana' }])
    expect(r[0].fechos).toBe(1)
    expect(r[0].vendasValor).toBe(50)
  })

  it('ordena por fechos, descendente', () => {
    const leads = [
      lead({ responsavel_id: 'pt1', estado: 'Ganha' }),
      lead({ responsavel_id: 'pt2', estado: 'Nova' }),
    ]
    const r = rankingComerciais(leads, [
      { id: 'pt2', nome: 'Bruno' },
      { id: 'pt1', nome: 'Ana' },
    ])
    expect(r[0].nome).toBe('Ana')
  })
})

describe('mapaDeCalorSemanaHora', () => {
  it('conta cada timestamp na sua hora de Lisboa, não na hora UTC crua', () => {
    // 19h UTC em janeiro é 19h em Lisboa (WET = UTC+0, sem DST).
    const grelha = mapaDeCalorSemanaHora(['2026-01-15T19:00:00Z'], 7, 21)
    // 2026-01-15 é quinta-feira (dia 4).
    expect(grelha[4][19 - 7]).toBe(1)
  })

  it('ignora timestamps fora da janela de horas pedida', () => {
    const grelha = mapaDeCalorSemanaHora(['2026-01-15T23:00:00Z'], 7, 21)
    const totalContado = grelha.flat().reduce((a, b) => a + b, 0)
    expect(totalContado).toBe(0)
  })

  it('devolve sempre 7 linhas (uma por dia da semana)', () => {
    const grelha = mapaDeCalorSemanaHora([], 7, 21)
    expect(grelha).toHaveLength(7)
  })
})
