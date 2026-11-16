import { describe, expect, it } from 'vitest'
import { agruparTarefas, emFoco, filtrarTarefas, focoDaPessoa, haQuantoTempo, idadeEmDias, type Tarefa } from './tarefas'

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
