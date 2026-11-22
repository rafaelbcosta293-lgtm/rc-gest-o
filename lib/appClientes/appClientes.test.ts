import { describe, expect, it } from 'vitest'
import { instanteLisboa, somarDiasIso } from './tempo'
import { impressao, montarAulas, montarDadosConta } from './copia'
import { avaliarDesmarcacao, erroDeRegra, fecharDesmarcacao } from './pedidos'
import { gerarCodigo, linkAtivacao, mensagemConvite } from './convite'

describe('tempo de Lisboa', () => {
  it('inverno = UTC, verão = UTC+1', () => {
    expect(instanteLisboa('2026-12-01', '18:30').toISOString()).toBe('2026-12-01T18:30:00.000Z')
    expect(instanteLisboa('2026-07-01', '18:30').toISOString()).toBe('2026-07-01T17:30:00.000Z')
  })
  it('soma dias', () => {
    expect(somarDiasIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDiasIso('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('cópia para a app do cliente', () => {
  const servicos = new Map([[3, { nome: 'Pilates', reserva_abre_horas: 48 }]])
  const nomes = new Map([['p1', 'Ana Maria Silva']])
  it('aulas: só horário, vagas e primeiro nome do instrutor', () => {
    const [a] = montarAulas(
      [{ id: 'a1', estudio_id: 2, servico_id: 3, data: '2026-12-02', hora_inicio: '19:00:00', duracao_min: 50, instrutor_id: 'p1', lotacao: 5, estado: 'Aberta' }],
      new Map([['a1', 7]]),
      servicos,
      nomes,
      new Map([[2, 'leiria']])
    )
    expect(a).toEqual({
      id: 'a1',
      estudio_slug: 'leiria',
      servico: 'Pilates',
      data: '2026-12-02',
      hora_inicio: '19:00',
      duracao_min: 50,
      instrutor: 'Ana',
      lotacao: 5,
      ocupadas: 5,
      estado: 'Aberta',
      reserva_abre_em: '2026-11-30T19:00:00.000Z',
      cancelar_ate: '2026-12-02T17:00:00.000Z',
    })
    expect(Object.keys(a)).not.toContain('inscritos')
  })
  it('aulas de estúdios sem contas ficam de fora', () => {
    expect(
      montarAulas(
        [{ id: 'a1', estudio_id: 9, servico_id: 3, data: '2026-12-02', hora_inicio: '19:00', duracao_min: 50, instrutor_id: null, lotacao: 5, estado: 'Aberta' }],
        new Map(),
        servicos,
        nomes,
        new Map([[2, 'leiria']])
      )
    ).toEqual([])
  })
  it('dados da conta: sem cliente_id, sem notas, presenças de treinos e aulas', () => {
    const d = montarDadosConta({
      contaId: 'c1',
      nome: 'Rui',
      eventos: [
        { id: 'e1', cliente_id: 'x', tipo: 'Treino', data: '2026-12-03', hora_inicio: '09:00:00', duracao_min: 60, estado: 'Agendado', pt_id: 'p1', servico_id: null },
        { id: 'e2', cliente_id: 'x', tipo: 'Reunião', data: '2026-12-03', hora_inicio: '10:00:00', duracao_min: 60, estado: 'Agendado', pt_id: null, servico_id: null },
      ],
      presencas: [{ id: 'pr1', cliente_id: 'x', data: '2026-11-01', estado: 'Presente' }],
      inscricoes: [
        { id: 'i1', cliente_id: 'x', aula_id: 'a1', estado: 'Presente', data: '2026-11-02', servico_id: 3 },
        { id: 'i2', cliente_id: 'x', aula_id: 'a2', estado: 'Inscrito', data: '2026-12-02', servico_id: 3 },
      ],
      avaliacoes: [],
      aulasNaApp: new Set(['a2']),
      servicos,
      nomes,
    })
    expect(d.treinos).toEqual([{ id: 'e1', data: '2026-12-03', hora_inicio: '09:00', duracao_min: 60, servico: 'Treino', instrutor: 'Ana', estado: 'Agendado' }])
    expect(d.presencas.map((p) => p.tipo)).toEqual(['Treino', 'Pilates'])
    expect(d.inscricoes).toEqual([{ aula_id: 'a2', estado: 'Inscrito' }])
    expect(JSON.stringify(d)).not.toContain('cliente_id')
    expect(impressao(d)).toBe(impressao(JSON.parse(JSON.stringify(d))))
  })
})

describe('pedidos da app', () => {
  const agora = new Date('2026-12-01T10:00:00Z')
  const ev = { id: 'e1', cliente_id: 'c1', tipo: 'Treino', estado: 'Agendado', data: '2026-12-02', hora_inicio: '09:00:00' }
  it('desmarcação só do próprio, agendado e no futuro', () => {
    expect(avaliarDesmarcacao(ev, 'c1', agora)).toBeNull()
    expect(avaliarDesmarcacao(ev, 'outro', agora)).toBe('Treino não encontrado.')
    expect(avaliarDesmarcacao({ ...ev, estado: 'Cancelado' }, 'c1', agora)).toBe('Este treino já está desmarcado.')
    expect(avaliarDesmarcacao({ ...ev, data: '2026-12-01', hora_inicio: '09:30' }, 'c1', agora)).toMatch(/já começou/)
  })
  it('fecha sozinho quando é desmarcado ou já passou', () => {
    expect(fecharDesmarcacao(ev, agora)).toBeNull()
    expect(fecharDesmarcacao({ ...ev, estado: 'Cancelado' }, agora)).toBe('aceite')
    expect(fecharDesmarcacao({ ...ev, data: '2026-11-30' }, agora)).toBe('recusado')
  })
  it('só os erros das regras vão para o cliente', () => {
    expect(erroDeRegra({ code: 'P0001', message: 'A aula está cheia.' })).toBe('A aula está cheia.')
    expect(erroDeRegra({ code: '08006', message: 'ligação' })).toBeNull()
  })
})

describe('convite', () => {
  it('código sem caracteres ambíguos', () => {
    const c = gerarCodigo()
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })
  it('link e mensagem', () => {
    const l = linkAtivacao('https://app.x', 'L25022', 'ABCD2345')
    expect(l).toBe('https://app.x/ativar?n=L25022&c=ABCD2345')
    expect(mensagemConvite('Rui', 'L25022', l, false)).toContain('nº de cliente: L25022')
  })
})
