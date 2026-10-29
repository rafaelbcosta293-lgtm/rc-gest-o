import { describe, expect, it } from 'vitest'
import {
  resumoMensalClientes,
  churnMensal,
  cancelamentoFimExperiencia,
  tempoMedioDeVidaMeses,
  mixFrequencia,
  matrizCoorte,
  scoreRisco,
  type ClienteParaRetencao,
} from './retencao'

function cliente(partial: Partial<ClienteParaRetencao>): ClienteParaRetencao {
  return {
    id: 'c1',
    estado: 'Ativo',
    frequencia_semanal: 2,
    inicio_contrato: '2026-01-10',
    fim_experiencia: null,
    saiu_em: null,
    ...partial,
  }
}

describe('resumoMensalClientes', () => {
  it('conta novos por inicio_contrato, e cancelados/suspensos/reativados pelas activities do mês', () => {
    const clientes = [
      cliente({ estado: 'Ativo', inicio_contrato: '2026-03-05' }),
      cliente({ estado: 'Ex-cliente', inicio_contrato: '2026-01-01' }),
    ]
    const atividades = [
      { tipo: 'Cancelamento', criado_em: '2026-03-10T10:00:00Z' },
      { tipo: 'Suspensão', criado_em: '2026-03-12T10:00:00Z' },
      { tipo: 'Reativação', criado_em: '2026-02-01T10:00:00Z' }, // fora do mês
    ]
    const r = resumoMensalClientes(clientes, atividades, '2026-03-01', '2026-04-01')
    expect(r.novos).toBe(1)
    expect(r.cancelados).toBe(1)
    expect(r.suspensos).toBe(1)
    expect(r.reativados).toBe(0)
  })
})

describe('churnMensal', () => {
  it('é cancelados / (ativos + cancelados), 0 quando não há nenhum', () => {
    expect(churnMensal(18, 2)).toBe(0.1)
    expect(churnMensal(0, 0)).toBe(0)
  })
})

describe('cancelamentoFimExperiencia', () => {
  it('conta só clientes cuja saída caiu perto do fim da experiência', () => {
    const clientes = [
      cliente({ fim_experiencia: '2026-02-01', saiu_em: '2026-02-03' }), // 2 dias depois — conta
      cliente({ fim_experiencia: '2026-02-01', saiu_em: '2026-04-01' }), // muito depois — não conta
      cliente({ fim_experiencia: '2026-02-01', saiu_em: null }), // continua ativo
    ]
    const r = cancelamentoFimExperiencia(clientes, '2026-05-01', 7)
    expect(r.total).toBe(3)
    expect(r.cancelados).toBe(1)
    expect(r.taxa).toBeCloseTo(1 / 3)
  })

  it('ignora clientes cuja experiência ainda não terminou', () => {
    const r = cancelamentoFimExperiencia([cliente({ fim_experiencia: '2026-05-10' })], '2026-05-01')
    expect(r.total).toBe(0)
  })
})

describe('tempoMedioDeVidaMeses', () => {
  it('calcula a média em meses só de quem já saiu', () => {
    const clientes = [
      cliente({ inicio_contrato: '2026-01-01', saiu_em: '2026-04-01' }), // 3 meses
      cliente({ inicio_contrato: '2026-01-01', saiu_em: '2026-02-01' }), // 1 mês
      cliente({ inicio_contrato: '2026-01-01', saiu_em: null }), // ainda ativo, fora da média
    ]
    expect(tempoMedioDeVidaMeses(clientes)).toBe(2)
  })

  it('devolve null sem nenhum cliente com vida completa', () => {
    expect(tempoMedioDeVidaMeses([cliente({ saiu_em: null })])).toBeNull()
  })
})

describe('mixFrequencia', () => {
  it('agrupa por frequência semanal, "Sem definição" para null', () => {
    const r = mixFrequencia([
      cliente({ frequencia_semanal: 2 }),
      cliente({ frequencia_semanal: 2 }),
      cliente({ frequencia_semanal: null }),
    ])
    expect(r.find((x) => x.frequencia === '2x/semana')?.total).toBe(2)
    expect(r.find((x) => x.frequencia === 'Sem definição')?.total).toBe(1)
  })
})

describe('matrizCoorte', () => {
  it('agrupa por mês de entrada e calcula retenção, com null para meses ainda não atingidos', () => {
    const clientes = [
      cliente({ inicio_contrato: '2026-01-05', saiu_em: null }),
      cliente({ inicio_contrato: '2026-01-10', saiu_em: '2026-02-20' }),
    ]
    const linhas = matrizCoorte(clientes, '2026-03-15', 12)
    const janeiro = linhas.find((l) => l.cohort === '2026-01')!
    expect(janeiro.tamanho).toBe(2)
    // mês 1 (até 2026-02-05): os dois ainda ativos -> 100%
    expect(janeiro.retencaoPorMes[0]).toBe(1)
    // mês 2 (até 2026-03-05): um já saiu em 2026-02-20 -> 50%
    expect(janeiro.retencaoPorMes[1]).toBe(0.5)
    // mês 3 (até 2026-04-05): ainda não chegou -> null
    expect(janeiro.retencaoPorMes[2]).toBeNull()
  })
})

describe('scoreRisco', () => {
  function sinais(partial: Partial<Parameters<typeof scoreRisco>[0]> = {}) {
    return {
      quebraAssiduidade: 0,
      desmarcacoesRecentes: 0,
      temTreinoAgendado: true,
      emDia: true,
      reavaliacaoVencida: false,
      diasParaFimExperiencia: null,
      ...partial,
    }
  }

  it('sem nenhum sinal de risco, o score é 0', () => {
    expect(scoreRisco(sinais())).toBe(0)
  })

  it('soma os pontos de cada sinal, sem nunca passar de 100', () => {
    const tudoMau = scoreRisco(
      sinais({
        quebraAssiduidade: 1,
        desmarcacoesRecentes: 5,
        temTreinoAgendado: false,
        emDia: false,
        reavaliacaoVencida: true,
        diasParaFimExperiencia: 3,
      })
    )
    expect(tudoMau).toBe(100)
  })

  it('quebra de assiduidade pesa proporcionalmente até 35 pontos', () => {
    expect(scoreRisco(sinais({ quebraAssiduidade: 0.5 }))).toBe(18)
  })
})
