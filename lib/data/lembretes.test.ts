import { describe, expect, it } from 'vitest'
import { montarItensCalendario, ocorrenciasLembrete, porTratar, type Lembrete } from './lembretes'
import type { DespesaRecorrente } from './despesas'

const lembrete = (extra: Partial<Lembrete>): Lembrete => ({
  id: 'l1',
  titulo: 'Entregar IVA',
  tipo: 'tarefa',
  data: '2026-11-20',
  periodicidade: 'unica',
  fim: null,
  valor: null,
  notas: null,
  estudio_id: null,
  ...extra,
})

describe('ocorrenciasLembrete', () => {
  it('um lembrete único só aparece na sua data', () => {
    expect(ocorrenciasLembrete(lembrete({}), '2026-11-01', '2026-11-30')).toEqual(['2026-11-20'])
    expect(ocorrenciasLembrete(lembrete({}), '2026-12-01', '2026-12-31')).toEqual([])
  })

  it('semanal: todas as semanas no mesmo dia, sem começar antes da primeira data', () => {
    const l = lembrete({ data: '2026-11-05', periodicidade: 'semanal' })
    expect(ocorrenciasLembrete(l, '2026-11-01', '2026-11-30')).toEqual(['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26'])
    // Meses mais tarde continua no mesmo dia da semana (quinta-feira).
    expect(ocorrenciasLembrete(l, '2027-02-01', '2027-02-14')).toEqual(['2027-02-04', '2027-02-11'])
  })

  it('mensal a dia 31 cai no último dia dos meses curtos', () => {
    const l = lembrete({ data: '2026-10-31', periodicidade: 'mensal' })
    expect(ocorrenciasLembrete(l, '2026-11-01', '2027-02-28')).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'])
  })

  it('trimestral e com fim: só os meses do ciclo, até à data de fim', () => {
    const l = lembrete({ data: '2026-01-15', periodicidade: 'trimestral', fim: '2026-08-01' })
    expect(ocorrenciasLembrete(l, '2026-01-01', '2026-12-31')).toEqual(['2026-01-15', '2026-04-15', '2026-07-15'])
  })
})

describe('montarItensCalendario', () => {
  const recorrente: DespesaRecorrente = {
    id: 'r1',
    estudio_id: 1,
    categoria: 'Serviços',
    subcategoria: 'Internet',
    descricao: null,
    valor: 40,
    periodicidade: 'mensal',
    dia_vencimento: 8,
    inicio: '2026-01-08',
    fim: null,
    dias_aviso: 3,
    ativo: true,
  }
  const despesa = {
    id: 'd1',
    estudio_id: 1,
    data: '2026-11-08',
    categoria: 'Serviços',
    subcategoria: 'Internet',
    descricao: null,
    valor: 40,
    pago: false,
    vencimento: '2026-11-08',
    dias_aviso: 3,
    recorrente_id: 'r1',
    anulado_em: null,
  }

  it('a recorrente já lançada aparece uma vez (como despesa), a do mês seguinte como prevista', () => {
    const itens = montarItensCalendario(
      { despesas: [despesa], recorrentes: [recorrente], lembretes: [], feitos: [] },
      '2026-11-01',
      '2026-12-31',
      '2026-11-15'
    )
    expect(itens.map((i) => `${i.origem} ${i.data}`)).toEqual(['despesa 2026-11-08', 'prevista 2026-12-08'])
    expect(itens[0]).toMatchObject({ estado: 'em_atraso', titulo: 'Internet', valor: 40 })
  })

  it('uma ocorrência anulada não aparece, nem volta como prevista', () => {
    const itens = montarItensCalendario(
      { despesas: [{ ...despesa, anulado_em: '2026-11-02T10:00:00Z' }], recorrentes: [recorrente], lembretes: [], feitos: [] },
      '2026-11-01',
      '2026-11-30',
      '2026-11-15'
    )
    expect(itens).toEqual([])
  })

  it('cada ocorrência de um lembrete que se repete tem o seu próprio "feito"', () => {
    const itens = montarItensCalendario(
      {
        despesas: [],
        recorrentes: [],
        lembretes: [lembrete({ data: '2026-10-10', periodicidade: 'mensal', tipo: 'pagamento', valor: 120 })],
        feitos: [{ lembrete_id: 'l1', data: '2026-10-10' }],
      },
      '2026-10-01',
      '2026-11-30',
      '2026-11-15'
    )
    expect(itens.map((i) => (i.origem === 'lembrete' ? `${i.data} ${i.feito}` : ''))).toEqual(['2026-10-10 true', '2026-11-10 false'])
    expect(itens.filter(porTratar)).toHaveLength(1)
  })
})
