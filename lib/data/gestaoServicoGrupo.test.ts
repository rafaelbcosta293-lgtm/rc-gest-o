import { describe, expect, it } from 'vitest'
import { emAtraso, resumir, semAulaMarcada, type ClienteDoServico } from './gestaoServicoGrupo'

const hoje = '2026-11-17'
const c = (o: Partial<ClienteDoServico>): ClienteDoServico => ({
  clienteId: 'x',
  nome: 'X',
  numeroSocio: null,
  telefone: null,
  estado: 'Ativo',
  inicio: null,
  saiuEm: null,
  validoAte: '2026-12-01',
  emDia: true,
  estadoPt: null,
  proximaAula: '2026-11-18',
  ultimaPresenca: null,
  presencasMes: 0,
  ...o,
})

describe('gestão de um serviço de grupo', () => {
  it('em atraso: sem pagamento em dia, menos os inativos', () => {
    expect(emAtraso(c({ emDia: false }))).toBe(true)
    expect(emAtraso(c({ emDia: false, estado: 'Pendente' }))).toBe(true)
    expect(emAtraso(c({ emDia: false, estado: 'Inativo' }))).toBe(false)
    expect(emAtraso(c({}))).toBe(false)
  })
  it('sem aula marcada: ativo sem aula nos próximos 7 dias', () => {
    expect(semAulaMarcada(c({ proximaAula: null }), hoje)).toBe(true)
    expect(semAulaMarcada(c({ proximaAula: '2026-11-30' }), hoje)).toBe(true)
    expect(semAulaMarcada(c({ proximaAula: '2026-11-24' }), hoje)).toBe(false)
    expect(semAulaMarcada(c({ proximaAula: null, estado: 'Pendente' }), hoje)).toBe(false)
  })
  it('resumo: contagens, quem também faz PT e ocupação da semana', () => {
    const r = resumir(
      [c({}), c({ estado: 'Pendente', emDia: false }), c({ estadoPt: 'Ativo', proximaAula: null }), c({ estado: 'Inativo', estadoPt: 'Ativo', emDia: false })],
      hoje,
      [
        { lotacao: 5, ocupadas: 4 },
        { lotacao: 5, ocupadas: 1 },
      ]
    )
    expect(r).toEqual({ ativos: 2, pendentes: 1, emAtraso: 1, semAulasMarcadas: 1, tambemPt: 1, aulasSemana: 2, ocupacaoSemana: 50 })
  })
})
