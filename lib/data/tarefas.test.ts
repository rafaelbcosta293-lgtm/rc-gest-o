import { describe, expect, it } from 'vitest'
import {
  agruparTarefas,
  descricaoRepeticao,
  diaDaSemanaISO,
  emFoco,
  escolhaDeRepeticao,
  estatisticasTarefas,
  filtrarTarefas,
  focoDaPessoa,
  haQuantoTempo,
  idadeEmDias,
  ocorrenciasPrevistas,
  primeiroDiaEm,
  proximaOcorrencia,
  type Tarefa,
} from './tarefas'

const HOJE = '2026-11-18' // quarta-feira; a semana começa a 2026-11-16

function tarefa(extra: Partial<Tarefa> & { id: string }): Tarefa {
  return {
    titulo: extra.id,
    descricao: null,
    lista: null,
    estudio_id: null,
    responsavel_id: null,
    prazo: null,
    estado: 'por_fazer',
    foco_semana: null,
    reservada: false,
    repete_dias: null,
    repete_mensal: false,
    concluida_em: null,
    criado_em: '2026-11-01T10:00:00Z',
    ...extra,
  }
}

describe('agruparTarefas', () => {
  it('põe cada tarefa numa só secção', () => {
    const g = agruparTarefas(
      [
        tarefa({ id: 'atrasada', prazo: '2026-11-10' }),
        tarefa({ id: 'hoje', prazo: HOJE }),
        tarefa({ id: 'proxima', prazo: '2026-12-01' }),
        tarefa({ id: 'sem-prazo' }),
        tarefa({ id: 'foco', prazo: '2026-11-10', foco_semana: '2026-11-16' }),
        tarefa({ id: 'foco-da-semana-passada', foco_semana: '2026-11-09' }),
        tarefa({ id: 'feita-ha-pouco', estado: 'feito', concluida_em: '2026-11-15T09:00:00Z' }),
        tarefa({ id: 'feita-ha-muito', estado: 'feito', concluida_em: '2026-10-01T09:00:00Z' }),
      ],
      HOJE
    )
    expect(g.foco.map((t) => t.id)).toEqual(['foco'])
    expect(g.urgentes.map((t) => t.id)).toEqual(['atrasada', 'hoje'])
    expect(g.proximas.map((t) => t.id)).toEqual(['proxima'])
    // O foco de uma semana que já passou volta à lista normal.
    expect(g.paraIrFazendo.map((t) => t.id)).toEqual(['sem-prazo', 'foco-da-semana-passada'])
    expect(g.feitas.map((t) => t.id)).toEqual(['feita-ha-pouco'])
  })

  it('"para ir fazendo" mostra primeiro as que esperam há mais tempo', () => {
    const g = agruparTarefas(
      [tarefa({ id: 'nova', criado_em: '2026-11-17T10:00:00Z' }), tarefa({ id: 'antiga', criado_em: '2026-05-01T10:00:00Z' })],
      HOJE
    )
    expect(g.paraIrFazendo.map((t) => t.id)).toEqual(['antiga', 'nova'])
  })
})

describe('foco da semana', () => {
  it('só conta o foco desta semana e de tarefas por concluir', () => {
    expect(emFoco({ foco_semana: '2026-11-16', estado: 'por_fazer' }, HOJE)).toBe(true)
    expect(emFoco({ foco_semana: '2026-11-16', estado: 'feito' }, HOJE)).toBe(false)
    expect(emFoco({ foco_semana: '2026-11-09', estado: 'por_fazer' }, HOJE)).toBe(false)
  })

  it('conta por responsável, sem a própria tarefa', () => {
    const lista = [
      tarefa({ id: 'a', responsavel_id: 'ana', foco_semana: '2026-11-16' }),
      tarefa({ id: 'b', responsavel_id: 'ana', foco_semana: '2026-11-16' }),
      tarefa({ id: 'c', responsavel_id: 'rui', foco_semana: '2026-11-16' }),
      tarefa({ id: 'd', responsavel_id: null, foco_semana: '2026-11-16' }),
    ]
    expect(focoDaPessoa(lista, 'ana', HOJE)).toBe(2)
    expect(focoDaPessoa(lista, 'ana', HOJE, 'a')).toBe(1)
    expect(focoDaPessoa(lista, null, HOJE)).toBe(1)
  })
})

describe('filtrarTarefas', () => {
  const lista = [
    tarefa({ id: 'ana-fatima', responsavel_id: 'ana', estudio_id: 1, lista: 'Marketing' }),
    tarefa({ id: 'rui-leiria', responsavel_id: 'rui', estudio_id: 2 }),
    tarefa({ id: 'geral-sem-dono' }),
  ]
  it('por pessoa, incluindo "sem responsável"', () => {
    expect(filtrarTarefas(lista, { pessoa: 'ana' }).map((t) => t.id)).toEqual(['ana-fatima'])
    expect(filtrarTarefas(lista, { pessoa: 'sem' }).map((t) => t.id)).toEqual(['geral-sem-dono'])
  })
  it('por estúdio, incluindo as da empresa toda', () => {
    expect(filtrarTarefas(lista, { estudioId: 2 }).map((t) => t.id)).toEqual(['rui-leiria'])
    expect(filtrarTarefas(lista, { estudioId: 'geral' }).map((t) => t.id)).toEqual(['geral-sem-dono'])
  })
  it('por lista, e sem filtros devolve tudo', () => {
    expect(filtrarTarefas(lista, { lista: 'Marketing' }).map((t) => t.id)).toEqual(['ana-fatima'])
    expect(filtrarTarefas(lista, {})).toHaveLength(3)
  })
})

describe('idade de uma tarefa', () => {
  it('conta os dias desde que foi criada', () => {
    expect(idadeEmDias('2026-11-18T08:00:00Z', HOJE)).toBe(0)
    expect(idadeEmDias('2026-11-06T23:00:00Z', HOJE)).toBe(12)
  })
  it('escreve-se por extenso', () => {
    expect(haQuantoTempo(0)).toBe('hoje')
    expect(haQuantoTempo(1)).toBe('há 1 dia')
    expect(haQuantoTempo(12)).toBe('há 12 dias')
    expect(haQuantoTempo(95)).toBe('há 3 meses')
  })
})

describe('tarefas que se repetem', () => {
  // HOJE = quarta-feira, 2026-11-18
  it('sabe o dia da semana (1 = segunda … 7 = domingo)', () => {
    expect(diaDaSemanaISO('2026-11-16')).toBe(1)
    expect(diaDaSemanaISO('2026-11-21')).toBe(6)
    expect(diaDaSemanaISO('2026-11-22')).toBe(7)
  })

  it('primeiro dia a partir de uma data, inclusive', () => {
    expect(primeiroDiaEm([3], HOJE)).toBe(HOJE)
    expect(primeiroDiaEm([1, 5], HOJE)).toBe('2026-11-20')
    expect(primeiroDiaEm([1], HOJE)).toBe('2026-11-23')
  })

  it('a vez seguinte é o próximo dia escolhido depois de hoje', () => {
    const uteis = { repete_dias: [1, 2, 3, 4, 5], repete_mensal: false }
    expect(proximaOcorrencia({ ...uteis, prazo: HOJE }, HOJE)).toBe('2026-11-19')
    // À sexta, a seguinte é segunda.
    expect(proximaOcorrencia({ ...uteis, prazo: '2026-11-20' }, '2026-11-20')).toBe('2026-11-23')
    // Concluída com atraso: não cria os dias que já passaram.
    expect(proximaOcorrencia({ ...uteis, prazo: '2026-11-02' }, HOJE)).toBe('2026-11-19')
    // Concluída antes do prazo: a seguinte é depois desse prazo.
    expect(proximaOcorrencia({ repete_dias: [1, 5], repete_mensal: false, prazo: '2026-11-20' }, HOJE)).toBe('2026-11-23')
    expect(proximaOcorrencia({ repete_dias: [6], repete_mensal: false, prazo: '2026-11-14' }, HOJE)).toBe('2026-11-21')
  })

  it('mensal: mesmo dia do mês seguinte, e o último dia fica último dia', () => {
    const mensal = { repete_dias: null, repete_mensal: true }
    expect(proximaOcorrencia({ ...mensal, prazo: '2026-11-10' }, HOJE)).toBe('2026-12-10')
    expect(proximaOcorrencia({ ...mensal, prazo: '2026-11-30' }, HOJE)).toBe('2026-12-31')
    expect(proximaOcorrencia({ ...mensal, prazo: '2027-01-31' }, '2027-01-31')).toBe('2027-02-28')
    // Atrasada dois meses: salta para o primeiro mês ainda por vir.
    expect(proximaOcorrencia({ ...mensal, prazo: '2026-09-25' }, HOJE)).toBe('2026-11-25')
  })

  it('uma tarefa que não se repete não tem vez seguinte', () => {
    expect(proximaOcorrencia({ repete_dias: null, repete_mensal: false, prazo: HOJE }, HOJE)).toBeNull()
  })

  it('descreve a repetição e reconhece as escolhas do formulário', () => {
    expect(descricaoRepeticao({ repete_dias: [1, 2, 3, 4, 5], repete_mensal: false })).toBe('dias úteis')
    expect(descricaoRepeticao({ repete_dias: [1, 2, 3, 4, 5, 6], repete_mensal: false })).toBe('seg a sáb')
    expect(descricaoRepeticao({ repete_dias: [5, 1], repete_mensal: false })).toBe('seg e sex')
    expect(descricaoRepeticao({ repete_dias: [3], repete_mensal: false })).toBe('qua, todas as semanas')
    expect(descricaoRepeticao({ repete_dias: null, repete_mensal: true })).toBe('todos os meses')
    expect(descricaoRepeticao({ repete_dias: null, repete_mensal: false })).toBeNull()
    expect(escolhaDeRepeticao({ repete_dias: [1, 2, 3, 4, 5], repete_mensal: false })).toBe('uteis')
    expect(escolhaDeRepeticao({ repete_dias: [1, 5], repete_mensal: false })).toBe('dias')
    expect(escolhaDeRepeticao({ repete_dias: null, repete_mensal: true })).toBe('mensal')
    expect(escolhaDeRepeticao({ repete_dias: null, repete_mensal: false })).toBe('nao')
  })
})

describe('calendário: vezes previstas de uma rotina', () => {
  it('lista as vezes seguintes dentro do intervalo, sem a que já existe', () => {
    expect(ocorrenciasPrevistas({ repete_dias: [1, 5], repete_mensal: false, prazo: '2026-11-16' }, '2026-11-16', '2026-11-30')).toEqual([
      '2026-11-20',
      '2026-11-23',
      '2026-11-27',
      '2026-11-30',
    ])
    expect(ocorrenciasPrevistas({ repete_dias: null, repete_mensal: true, prazo: '2026-11-30' }, '2026-12-01', '2027-02-28')).toEqual([
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
    ])
    expect(ocorrenciasPrevistas({ repete_dias: null, repete_mensal: false, prazo: '2026-11-16' }, '2026-11-01', '2026-12-31')).toEqual([])
  })
})

describe('estatísticas do painel', () => {
  const feita = (id: string, concluida_em: string, extra: Partial<Tarefa> = {}) => ({
    ...tarefa({ id, estado: 'feito', concluida_em, ...extra }),
  })
  it('conta abertas, atrasos, concluídas e cumprimento do prazo', () => {
    const abertas = [
      tarefa({ id: 'a', prazo: '2026-11-10', responsavel_id: 'ana', lista: 'Marketing' }),
      tarefa({ id: 'b', prazo: HOJE, responsavel_id: 'ana' }),
      tarefa({ id: 'c', responsavel_id: 'rui', criado_em: '2026-05-01T10:00:00Z' }),
      tarefa({ id: 'd', prazo: '2026-12-01', repete_dias: [1], criado_em: '2026-01-01T10:00:00Z' }),
    ]
    const feitas = [
      feita('f1', '2026-11-17T10:00:00Z', { prazo: '2026-11-17', responsavel_id: 'ana', lista: 'Marketing' }),
      feita('f2', '2026-11-12T10:00:00Z', { prazo: '2026-11-10', responsavel_id: 'rui' }),
      feita('f3', '2026-11-03T10:00:00Z'),
      feita('f4', '2026-10-01T10:00:00Z', { prazo: '2026-10-01' }),
    ]
    const e = estatisticasTarefas(abertas, feitas, HOJE)
    expect(e).toMatchObject({ abertas: 4, emAtraso: 1, paraHoje: 1, semPrazo: 1, feitas7: 2, feitas30: 3, comPrazo30: 2, noPrazo30: 1 })
    expect(e.porSemana).toHaveLength(8)
    expect(e.porSemana[7]).toEqual({ inicio: '2026-11-16', total: 1 })
    expect(e.porSemana[6]).toEqual({ inicio: '2026-11-09', total: 1 })
    expect(e.porPessoa.find((p) => p.id === 'ana')).toEqual({ id: 'ana', abertas: 2, emAtraso: 1, feitas30: 1 })
    expect(e.porLista.find((l) => l.lista === 'Marketing')).toEqual({ lista: 'Marketing', abertas: 1, feitas30: 1 })
    // As rotinas que se repetem não entram nas "abertas há mais tempo".
    expect(e.maisAntigas.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })
})
