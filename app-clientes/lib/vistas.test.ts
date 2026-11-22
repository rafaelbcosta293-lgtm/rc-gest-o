import { describe, expect, it } from 'vitest'
import { presencasPorMes, ultimoPedidoPorAlvo, vagas, vistaAula } from './vistas'
import { emailDaConta, limparNumeroCliente } from './supabase'
import { diaPorExtenso } from './datas'
import type { Aula } from './dados'

const aula: Aula = {
  id: 'a1',
  servico: 'Pilates',
  data: '2026-12-02',
  hora_inicio: '19:00',
  duracao_min: 50,
  instrutor: 'Ana',
  lotacao: 5,
  ocupadas: 3,
  estado: 'Aberta',
  reserva_abre_em: '2026-11-30T19:00:00.000Z',
  cancelar_ate: '2026-12-02T17:00:00.000Z',
}

describe('aulas', () => {
  it('reservar só quando abre, há vaga e ainda não começou', () => {
    expect(vistaAula(aula, false, undefined, new Date('2026-11-29T10:00:00Z'))).toMatchObject({ acao: 'nenhuma', texto: expect.stringMatching(/^Reservas abrem 30\/11 às 19:00/) })
    expect(vistaAula(aula, false, undefined, new Date('2026-12-01T10:00:00Z'))).toEqual({ acao: 'reservar' })
    expect(vistaAula({ ...aula, ocupadas: 5 }, false, undefined, new Date('2026-12-01T10:00:00Z'))).toMatchObject({ texto: 'Aula cheia' })
    expect(vistaAula(aula, false, undefined, new Date('2026-12-02T19:05:00Z'))).toMatchObject({ texto: 'Já começou' })
  })
  it('cancelar até 2 h antes', () => {
    expect(vistaAula(aula, true, undefined, new Date('2026-12-02T16:00:00Z'))).toEqual({ acao: 'cancelar' })
    expect(vistaAula(aula, true, undefined, new Date('2026-12-02T17:30:00Z'))).toMatchObject({ acao: 'nenhuma', texto: 'Está inscrito' })
  })
  it('pedido em curso tem prioridade', () => {
    const p = { id: 'p', tipo: 'inscrever_aula', alvo: 'a1', estado: 'pendente', resposta: null, criado_em: '' }
    expect(vistaAula(aula, false, p, new Date('2026-12-01T10:00:00Z'))).toEqual({ acao: 'em_curso' })
    expect(ultimoPedidoPorAlvo([p, { ...p, id: 'q', estado: 'aceite' }]).get('a1')?.id).toBe('p')
  })
  it('vagas', () => {
    expect(vagas(aula)).toBe('2 vagas')
    expect(vagas({ ...aula, ocupadas: 4 })).toBe('1 vaga')
    expect(vagas({ ...aula, ocupadas: 6 })).toBe('Sem vagas')
  })
})

describe('outros', () => {
  it('presenças por mês', () => {
    expect(
      presencasPorMes([
        { data: '2026-11-03', estado: 'Presente' },
        { data: '2026-11-05', estado: 'Faltou (avisou)' },
        { data: '2026-10-01', estado: 'Presente' },
      ])
    ).toEqual([
      { mes: '2026-11', presentes: 1, faltas: 1 },
      { mes: '2026-10', presentes: 1, faltas: 0 },
    ])
  })
  it('email interno igual ao da base de dados', () => {
    expect(emailDaConta('L-25022')).toBe('l25022@clientes.rc-app.invalid')
    expect(limparNumeroCliente(' l 25022 ')).toBe('L25022')
  })
  it('dias por extenso', () => {
    expect(diaPorExtenso('2026-12-01', '2026-12-01')).toBe('Hoje')
    expect(diaPorExtenso('2026-12-02', '2026-12-01')).toBe('Amanhã')
    expect(diaPorExtenso('2026-12-04', '2026-12-01')).toBe('sexta, 4 dez')
  })
})
