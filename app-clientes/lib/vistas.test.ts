import { describe, expect, it } from 'vitest'
import { estadoAula, plural, presencasPorMes, ultimoPedidoPorAlvo, vagas, variacao } from './vistas'
import { emailDaConta, limparNumeroCliente } from './supabase'
import { dataCurta, diaLongo, diaPorExtenso, nomeMes, quandoAbre, tituloDia } from './datas'
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
    expect(estadoAula(aula, false, undefined, new Date('2026-11-29T10:00:00Z'))).toEqual({ tipo: 'por_abrir', abre: aula.reserva_abre_em })
    expect(estadoAula(aula, false, undefined, new Date('2026-12-01T10:00:00Z'))).toEqual({ tipo: 'reservar' })
    expect(estadoAula({ ...aula, ocupadas: 5 }, false, undefined, new Date('2026-12-01T10:00:00Z'))).toEqual({ tipo: 'cheia' })
    expect(estadoAula(aula, false, undefined, new Date('2026-12-02T19:05:00Z'))).toEqual({ tipo: 'terminada' })
  })
  it('cancelar até 2 h antes', () => {
    expect(estadoAula(aula, true, undefined, new Date('2026-12-02T16:00:00Z'))).toEqual({ tipo: 'cancelar' })
    expect(estadoAula(aula, true, undefined, new Date('2026-12-02T17:30:00Z'))).toEqual({ tipo: 'inscrito' })
    expect(estadoAula(aula, true, undefined, new Date('2026-12-02T19:30:00Z'))).toEqual({ tipo: 'inscrito' })
  })
  it('aula cancelada pelo estúdio, mesmo para quem estava inscrito', () => {
    expect(estadoAula({ ...aula, estado: 'Cancelada' }, true, undefined, new Date('2026-12-01T10:00:00Z'))).toEqual({ tipo: 'cancelada' })
  })
  it('pedido em curso tem prioridade', () => {
    const p = { id: 'p', tipo: 'inscrever_aula', alvo: 'a1', estado: 'pendente', resposta: null, criado_em: '' }
    expect(estadoAula(aula, false, p, new Date('2026-12-01T10:00:00Z'))).toEqual({ tipo: 'em_curso' })
    expect(ultimoPedidoPorAlvo([p, { ...p, id: 'q', estado: 'aceite' }]).get('a1')?.id).toBe('p')
  })
  it('vagas', () => {
    expect(vagas(aula)).toBe('2 vagas')
    expect(vagas({ ...aula, ocupadas: 4 })).toBe('Última vaga')
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
  it('plural e variação', () => {
    expect(plural(1, 'treino', 'treinos')).toBe('1 treino')
    expect(plural(0, 'treino', 'treinos')).toBe('0 treinos')
    expect(variacao(82.4, 77.6)).toBe(-4.8)
    expect(variacao(null, 77.6)).toBeNull()
  })
  it('email interno igual ao da base de dados', () => {
    expect(emailDaConta('L-25022')).toBe('l25022@clientes.rc-app.invalid')
    expect(limparNumeroCliente(' l 25022 ')).toBe('L25022')
  })
  it('datas em português', () => {
    expect(diaPorExtenso('2026-12-01', '2026-12-01')).toBe('Hoje')
    expect(diaPorExtenso('2026-12-02', '2026-12-01')).toBe('Amanhã')
    expect(diaPorExtenso('2026-12-04', '2026-12-01')).toBe('sexta, 4 dez')
    expect(tituloDia('2026-12-01', '2026-12-01')).toBe('Hoje · 1 dez')
    expect(tituloDia('2026-12-04', '2026-12-01')).toBe('Sexta · 4 dez')
    expect(diaLongo('2026-11-22')).toBe('domingo, 22 de novembro')
    expect(dataCurta('2026-11-20', '2026-11-22')).toBe('20 nov')
    expect(dataCurta('2025-11-20', '2026-11-22')).toBe('20 nov 2025')
    expect(nomeMes('2026-11')).toBe('novembro 2026')
  })
  it('quando abrem as reservas, em linguagem corrente', () => {
    const agora = new Date('2026-11-29T10:00:00Z')
    expect(quandoAbre('2026-11-29T19:00:00Z', agora)).toBe('hoje às 19:00')
    expect(quandoAbre('2026-11-30T19:00:00Z', agora)).toBe('amanhã às 19:00')
    expect(quandoAbre('2026-12-02T19:00:00Z', agora)).toBe('qua, 2 dez às 19:00')
  })
})
