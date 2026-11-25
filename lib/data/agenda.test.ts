import { describe, expect, it, vi } from 'vitest'
import {
  gerarOcorrencias,
  gerarExtensaoSerie,
  corTipoEvento,
  eventoJaTerminou,
  pesquisarEventosAgenda,
  type EventoPesquisavel,
  correspondePalavras,
  ocorrenciasAMover,
  diasEntre,
  limparMotivoDesmarcacao,
  MAX_MOTIVO_DESMARCACAO,
} from './agenda'

describe('gerarOcorrencias', () => {
  it('sem repetição devolve só a data inicial', () => {
    expect(gerarOcorrencias('2026-03-02', 'nao', { modo: 'vezes', vezes: 5 })).toEqual(['2026-03-02'])
  })

  it('semanal, N vezes, gera datas de 7 em 7 dias', () => {
    expect(gerarOcorrencias('2026-03-02', 'semanal', { modo: 'vezes', vezes: 3 })).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ])
  })

  it('quinzenal, N vezes, gera datas de 14 em 14 dias', () => {
    expect(gerarOcorrencias('2026-03-02', 'quinzenal', { modo: 'vezes', vezes: 3 })).toEqual([
      '2026-03-02',
      '2026-03-16',
      '2026-03-30',
    ])
  })

  it('semanal "até" inclui a data limite quando cai exatamente num passo', () => {
    expect(gerarOcorrencias('2026-03-02', 'semanal', { modo: 'ate', ate: '2026-03-16' })).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ])
  })

  it('nunca gera mais do que o limite de segurança (52), mesmo pedindo muito mais', () => {
    expect(gerarOcorrencias('2026-01-01', 'semanal', { modo: 'vezes', vezes: 500 })).toHaveLength(52)
  })

  it('"vezes" nunca gera menos de 1 ocorrência mesmo com um valor inválido', () => {
    expect(gerarOcorrencias('2026-03-02', 'semanal', { modo: 'vezes', vezes: 0 })).toEqual(['2026-03-02'])
  })

  it('"indefinido" gera a janela inicial (90 dias) a partir da data inicial, sem pedir data de fim', () => {
    const datas = gerarOcorrencias('2026-03-02', 'semanal', { modo: 'indefinido' })
    expect(datas[0]).toBe('2026-03-02')
    // 90 dias ÷ 7 ≈ 12 semanas, mais a primeira — sem ultrapassar o
    // limite de segurança nem a janela.
    expect(datas.length).toBeGreaterThan(10)
    expect(datas.length).toBeLessThanOrEqual(52)
    expect(datas[datas.length - 1] <= '2026-05-31').toBe(true) // 2026-03-02 + 90 dias
  })
})

describe('gerarExtensaoSerie', () => {
  it('sem nada para estender (última data já cobre o horizonte), devolve uma lista vazia', () => {
    expect(gerarExtensaoSerie('2026-06-01', 'semanal', '2026-03-02')).toEqual([])
  })

  it('estende a partir do próximo passo depois da última data gerada', () => {
    const datas = gerarExtensaoSerie('2026-03-02', 'semanal', '2026-03-02')
    expect(datas[0]).toBe('2026-03-09')
    expect(datas.every((d) => d > '2026-03-02')).toBe(true)
  })

  it('quinzenal estende de 14 em 14 dias', () => {
    const datas = gerarExtensaoSerie('2026-03-02', 'quinzenal', '2026-03-02')
    expect(datas[0]).toBe('2026-03-16')
  })
})

describe('corTipoEvento', () => {
  it('devolve uma cor diferente por tipo de evento', () => {
    const cores = new Set(
      (['Treino', 'Avaliação', 'Reunião', 'Outro'] as const).map((t) => corTipoEvento(t).tx)
    )
    expect(cores.size).toBe(4)
  })
})

describe('eventoJaTerminou', () => {
  it('ainda não terminou quando o fim está no futuro', () => {
    vi.setSystemTime(new Date('2026-11-11T10:00:00'))
    expect(eventoJaTerminou('2026-11-11', '10:30', 40)).toBe(false)
    vi.useRealTimers()
  })

  it('já terminou quando o fim já passou', () => {
    vi.setSystemTime(new Date('2026-11-11T10:00:00'))
    expect(eventoJaTerminou('2026-11-11', '09:00', 40)).toBe(true)
    vi.useRealTimers()
  })

  it('data no futuro nunca conta como terminada', () => {
    vi.setSystemTime(new Date('2026-11-11T23:00:00'))
    expect(eventoJaTerminou('2026-11-12', '06:50', 40)).toBe(false)
    vi.useRealTimers()
  })
})

describe('pesquisarEventosAgenda', () => {
  const base: EventoPesquisavel = {
    id: '1',
    data: '2026-11-11',
    hora_inicio: '10:00',
    duracao_min: 40,
    tipo: 'Treino',
    titulo: null,
    estado: 'Agendado',
    nota: null,
    cliente: { nome: 'Joana Pêpê', nome_preferido: null, numero_socio: 'F24010' },
    pt: { nome: 'Carolina Ribeiro' },
  }
  const eventos: EventoPesquisavel[] = [
    base,
    { ...base, id: '2', cliente: { nome: 'Miguel Alves', nome_preferido: null, numero_socio: 'F24020' } },
    { ...base, id: '3', tipo: 'Reunião', titulo: 'Reunião de equipa', cliente: null, pt: null },
    { ...base, id: '4', nota: 'Confirmar com o André', cliente: null, pt: null },
  ]

  it('encontra pelo nome do cliente, sem distinguir acentos/maiúsculas', () => {
    expect(pesquisarEventosAgenda(eventos, 'joana pepe').map((e) => e.id)).toEqual(['1'])
  })

  it('encontra por nº de sócio', () => {
    expect(pesquisarEventosAgenda(eventos, 'F24020').map((e) => e.id)).toEqual(['2'])
  })

  it('encontra pelo nome do instrutor', () => {
    expect(pesquisarEventosAgenda(eventos, 'carolina').map((e) => e.id)).toEqual(['1', '2'])
  })

  it('encontra por título (ex.: Reunião)', () => {
    expect(pesquisarEventosAgenda(eventos, 'equipa').map((e) => e.id)).toEqual(['3'])
  })

  it('encontra por nota', () => {
    expect(pesquisarEventosAgenda(eventos, 'andré').map((e) => e.id)).toEqual(['4'])
  })

  it('texto vazio não devolve nada', () => {
    expect(pesquisarEventosAgenda(eventos, '   ')).toEqual([])
  })
})

describe('pesquisa por palavras em qualquer ordem', () => {
  const nomes = ['Maria João Garcia', 'João Maria Santos', 'Maria Silva', 'Ana Garcia']
  const procura = (texto: string) => nomes.filter((n) => correspondePalavras(texto.toLowerCase().split(' '), [n]))

  it('"Maria Garcia" encontra "Maria João Garcia" (há um nome no meio)', () => {
    expect(procura('maria garcia')).toEqual(['Maria João Garcia'])
  })

  it('"João Maria" encontra também "Maria João", sem acentos', () => {
    expect(procura('joao maria')).toEqual(['Maria João Garcia', 'João Maria Santos'])
  })

  it('basta o início das palavras', () => {
    expect(procura('gar ana')).toEqual(['Ana Garcia'])
  })

  it('nos eventos também (nome do cliente)', () => {
    const base = {
      id: '1',
      data: '2026-11-11',
      hora_inicio: '10:00',
      duracao_min: 40,
      tipo: 'Treino' as const,
      titulo: null,
      estado: 'Agendado' as const,
      nota: null,
      cliente: { nome: 'Maria João Garcia', nome_preferido: null, numero_socio: null },
      pt: null,
    }
    expect(pesquisarEventosAgenda([base], 'Garcia Maria').map((e) => e.id)).toEqual(['1'])
    expect(pesquisarEventosAgenda([base], 'Maria Pedro')).toEqual([])
  })
})

describe('arrastar um evento de uma série', () => {
  const o = (id: string, data: string, estado: 'Agendado' | 'Cancelado' | 'Concluído' = 'Agendado') => ({ id, data, hora_inicio: '10:00', duracao_min: 40, estado })
  // Terças-feiras.
  const serie = [o('a', '2026-11-03', 'Concluído'), o('b', '2026-11-10'), o('c', '2026-11-17'), o('d', '2026-11-24', 'Cancelado'), o('e', '2026-12-01')]
  const jaPassou = (x: { data: string }) => x.data < '2026-11-10'

  it('de terça para segunda: todas um dia antes', () => {
    expect(diasEntre('2026-11-17', '2026-11-16')).toBe(-1)
    expect(ocorrenciasAMover(serie, 'serie', '2026-11-17', '2026-11-16', jaPassou)).toEqual([
      { id: 'b', dataNova: '2026-11-09' },
      { id: 'c', dataNova: '2026-11-16' },
      { id: 'e', dataNova: '2026-11-30' },
    ])
  })

  it('"este e os seguintes" não mexe nos anteriores', () => {
    expect(ocorrenciasAMover(serie, 'seguintes', '2026-11-17', '2026-11-18', jaPassou).map((x) => x.id)).toEqual(['c', 'e'])
  })

  it('as que já aconteceram e as desmarcadas ficam como estão', () => {
    const ids = ocorrenciasAMover(serie, 'serie', '2026-11-17', '2026-11-17', jaPassou).map((x) => x.id)
    expect(ids).not.toContain('a')
    expect(ids).not.toContain('d')
  })
})

describe('limparMotivoDesmarcacao', () => {
  it('tira espaços a mais e trata o vazio como "sem motivo"', () => {
    expect(limparMotivoDesmarcacao('  Doença   (gripe) ')).toBe('Doença (gripe)')
    expect(limparMotivoDesmarcacao('   ')).toBeNull()
    expect(limparMotivoDesmarcacao(null)).toBeNull()
    expect(limparMotivoDesmarcacao(undefined)).toBeNull()
  })
  it('limita o tamanho', () => {
    expect(limparMotivoDesmarcacao('a'.repeat(500))).toHaveLength(MAX_MOTIVO_DESMARCACAO)
  })
})
