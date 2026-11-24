import { describe, expect, it } from 'vitest'
import {
  avaliarLeads,
  avaliarClientes,
  reconciliarAlertas,
  semanasDeTreino,
  type LeadParaAlertas,
  type ClienteParaAlertas,
  type AlertaExistente,
} from './alertas'

function lead(partial: Partial<LeadParaAlertas>): LeadParaAlertas {
  return {
    id: 'l1',
    estudio_id: 1,
    nome: 'Ana',
    estado: 'Nova',
    proximo_contacto: null,
    visita_data: null,
    visita_hora: null,
    criado_em: '2026-03-01T10:00:00Z',
    ultima_atividade_em: '2026-03-01T10:00:00Z',
    ...partial,
  }
}

function cliente(partial: Partial<ClienteParaAlertas>): ClienteParaAlertas {
  return {
    id: 'c1',
    estudio_id: 1,
    nome: 'Bruno',
    nascimento: null,
    fim_experiencia: null,
    treinos_esta_semana: true,
    treinos_semana_seguinte: true,
    desmarcacoes_consecutivas: 0,
    desmarcacoes_acumuladas: 0,
    proxima_reavaliacao: null,
    em_dia: true,
    valido_ate: null,
    ...partial,
  }
}

describe('avaliarLeads', () => {
  it('ignora leads já fechadas (Ganha/Perdida)', () => {
    const c = avaliarLeads([lead({ estado: 'Ganha' }), lead({ estado: 'Perdida' })], '2026-03-05T10:00:00Z')
    expect(c).toHaveLength(0)
  })

  it('lead "Nova" sobe de Atenção (2h) para Crítico (24h) sem contacto', () => {
    const atencao = avaliarLeads(
      [lead({ criado_em: '2026-03-01T10:00:00Z' })],
      '2026-03-01T13:00:00Z'
    )
    expect(atencao.find((a) => a.regraChave === 'lead_sem_contacto')?.severidade).toBe('Atenção')

    const critico = avaliarLeads(
      [lead({ criado_em: '2026-03-01T10:00:00Z' })],
      '2026-03-02T11:00:00Z'
    )
    expect(critico.find((a) => a.regraChave === 'lead_sem_contacto')?.severidade).toBe('Crítico')
  })

  it('não dispara lead_sem_contacto antes das 2h', () => {
    const c = avaliarLeads([lead({ criado_em: '2026-03-01T10:00:00Z' })], '2026-03-01T11:00:00Z')
    expect(c.some((a) => a.regraChave === 'lead_sem_contacto')).toBe(false)
  })

  it('próxima ação vencida dispara lead_sem_seguimento mesmo com atividade recente', () => {
    const c = avaliarLeads(
      [lead({ estado: 'Contactada', proximo_contacto: '2026-03-01', ultima_atividade_em: '2026-03-04T10:00:00Z' })],
      '2026-03-05T10:00:00Z'
    )
    expect(c.some((a) => a.regraChave === 'lead_sem_seguimento')).toBe(true)
  })

  it('experimental amanhã dispara experimental_amanha', () => {
    const c = avaliarLeads(
      [lead({ estado: 'Experimental agendada', visita_data: '2026-03-02', visita_hora: '18:00' })],
      '2026-03-01T10:00:00Z'
    )
    expect(c.find((a) => a.regraChave === 'experimental_amanha')?.titulo).toContain('18:00')
  })

  it('experimental falhada há 48h+ dispara experimental_falhada_sem_reagendar', () => {
    const c = avaliarLeads(
      [lead({ estado: 'Falhou a experimental', ultima_atividade_em: '2026-03-01T10:00:00Z' })],
      '2026-03-03T11:00:00Z'
    )
    expect(c.some((a) => a.regraChave === 'experimental_falhada_sem_reagendar')).toBe(true)
  })

  it('experimental realizada há 5+ dias sem decisão dispara experimental_sem_decisao', () => {
    const c = avaliarLeads(
      [lead({ estado: 'Experimental realizada', ultima_atividade_em: '2026-03-01T10:00:00Z' })],
      '2026-03-06T10:00:00Z'
    )
    expect(c.some((a) => a.regraChave === 'experimental_sem_decisao')).toBe(true)
  })
})

describe('avaliarClientes', () => {
  // 2026-03-02 é segunda-feira; 2026-03-05 é quinta; 2026-03-08 é domingo.
  const semTreinos = (c: Partial<ClienteParaAlertas>, hoje: string) =>
    avaliarClientes([cliente(c)], hoje).find((a) => a.regraChave === 'cliente_sem_treino_agendado')

  it('sem treinos nesta semana: alerta Crítico em qualquer dia', () => {
    for (const hoje of ['2026-03-02', '2026-03-04', '2026-03-05', '2026-03-08']) {
      const a = semTreinos({ treinos_esta_semana: false }, hoje)
      expect(a?.severidade).toBe('Crítico')
      expect(a?.titulo).toBe('Bruno: ativo sem treinos nesta semana')
    }
  })

  it('sem treinos na semana seguinte: só avisa de quinta a domingo', () => {
    for (const hoje of ['2026-03-02', '2026-03-03', '2026-03-04']) {
      expect(semTreinos({ treinos_semana_seguinte: false }, hoje)).toBeUndefined()
    }
    for (const hoje of ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']) {
      expect(semTreinos({ treinos_semana_seguinte: false }, hoje)?.titulo).toBe('Bruno: ativo sem treinos marcados para a semana que vem')
    }
  })

  it('de quinta a domingo sem nada nas duas semanas: um só alerta, com as duas', () => {
    const a = semTreinos({ treinos_esta_semana: false, treinos_semana_seguinte: false }, '2026-03-06')
    expect(a?.titulo).toBe('Bruno: ativo sem treinos nesta semana nem na próxima')
    // À segunda, o que era "a semana que vem" passou a ser "esta semana".
    expect(semTreinos({ treinos_esta_semana: false, treinos_semana_seguinte: false }, '2026-03-09')?.titulo).toBe(
      'Bruno: ativo sem treinos nesta semana'
    )
  })

  it('semanasDeTreino: de segunda a domingo, e a semana seguinte', () => {
    expect(semanasDeTreino('2026-03-05')).toEqual({ estaSemana: ['2026-03-02', '2026-03-08'], semanaSeguinte: ['2026-03-09', '2026-03-15'], diaSemana: 4 })
    expect(semanasDeTreino('2026-03-08').estaSemana).toEqual(['2026-03-02', '2026-03-08'])
    expect(semanasDeTreino('2026-03-09').estaSemana).toEqual(['2026-03-09', '2026-03-15'])
  })

  it('pendente sem treino agendado dispara o mesmo alerta — e só esse', () => {
    const c = avaliarClientes(
      [
        cliente({
          estado: 'Pendente',
          treinos_esta_semana: false,
          em_dia: false,
          desmarcacoes_consecutivas: 3,
          proxima_reavaliacao: '2026-03-01',
        }),
      ],
      '2026-03-20'
    )
    expect(c.map((a) => a.regraChave)).toEqual(['cliente_sem_treino_agendado'])
    expect(c[0].titulo).toContain('pendente sem treinos nesta semana')
    expect(c[0].severidade).toBe('Crítico')
  })

  it('pendente com treino marcado não tem alerta', () => {
    expect(avaliarClientes([cliente({ estado: 'Pendente', em_dia: false })], '2026-03-20')).toEqual([])
  })

  it('2 desmarcações consecutivas ou 5 acumuladas disparam cliente_limite_desmarcacoes', () => {
    expect(
      avaliarClientes([cliente({ desmarcacoes_consecutivas: 2 })], '2026-03-05').some(
        (a) => a.regraChave === 'cliente_limite_desmarcacoes'
      )
    ).toBe(true)
    expect(
      avaliarClientes([cliente({ desmarcacoes_acumuladas: 5 })], '2026-03-05').some(
        (a) => a.regraChave === 'cliente_limite_desmarcacoes'
      )
    ).toBe(true)
    expect(
      avaliarClientes([cliente({ desmarcacoes_consecutivas: 1, desmarcacoes_acumuladas: 1 })], '2026-03-05').some(
        (a) => a.regraChave === 'cliente_limite_desmarcacoes'
      )
    ).toBe(false)
  })

  it('fim da experiência a 7 dias ou menos dispara fim_experiencia_proximo, nunca depois de passar', () => {
    expect(
      avaliarClientes([cliente({ fim_experiencia: '2026-03-10' })], '2026-03-05').some(
        (a) => a.regraChave === 'fim_experiencia_proximo'
      )
    ).toBe(true)
    expect(
      avaliarClientes([cliente({ fim_experiencia: '2026-03-04' })], '2026-03-05').some(
        (a) => a.regraChave === 'fim_experiencia_proximo'
      )
    ).toBe(false)
  })

  it('reavaliação: atrasada (Atenção) quando a data já passou, próxima (Info) até 14 dias', () => {
    const atrasada = avaliarClientes([cliente({ proxima_reavaliacao: '2026-03-01' })], '2026-03-05')
    expect(atrasada.find((a) => a.regraChave === 'reavaliacao_atrasada')?.severidade).toBe('Atenção')

    const proxima = avaliarClientes([cliente({ proxima_reavaliacao: '2026-03-15' })], '2026-03-05')
    expect(proxima.find((a) => a.regraChave === 'reavaliacao_proxima')?.severidade).toBe('Info')
  })

  it('aniversário hoje compara só mês/dia, ignorando o ano de nascimento', () => {
    const c = avaliarClientes([cliente({ nascimento: '1990-03-05' })], '2026-03-05')
    expect(c.some((a) => a.regraChave === 'aniversario_hoje')).toBe(true)
  })

  it('mensalidade em atraso só dispara depois do dia 8 do mês, e nunca quando em_dia', () => {
    expect(
      avaliarClientes([cliente({ em_dia: false })], '2026-03-05').some((a) => a.regraChave === 'mensalidade_em_atraso')
    ).toBe(false)
    expect(
      avaliarClientes([cliente({ em_dia: false })], '2026-03-09').some((a) => a.regraChave === 'mensalidade_em_atraso')
    ).toBe(true)
    expect(
      avaliarClientes([cliente({ em_dia: true })], '2026-03-09').some((a) => a.regraChave === 'mensalidade_em_atraso')
    ).toBe(false)
  })

  it('nunca inclui valores em € na descrição (regra de ouro)', () => {
    const candidatos = avaliarClientes(
      [cliente({ em_dia: false, valido_ate: '2026-03-10' })],
      '2026-03-09'
    )
    for (const c of candidatos) {
      expect(c.titulo).not.toMatch(/€|\beur\b/i)
    }
  })
})

describe('reconciliarAlertas', () => {
  function existente(partial: Partial<AlertaExistente>): AlertaExistente {
    return { id: 'a1', regraChave: 'lead_sem_contacto', leadId: 'l1', clienteId: null, estado: 'Novo', adiadoAte: null, ...partial }
  }

  it('não duplica um alerta já ativo para a mesma regra+entidade', () => {
    const r = reconciliarAlertas(
      [existente({})],
      [{ regraChave: 'lead_sem_contacto', severidade: 'Atenção', titulo: 'x', estudioId: 1, leadId: 'l1' }],
      '2026-03-05'
    )
    expect(r.paraCriar).toHaveLength(0)
  })

  it('resolve automaticamente um alerta ativo cuja condição deixou de se verificar', () => {
    const r = reconciliarAlertas([existente({})], [], '2026-03-05')
    expect(r.paraResolver).toEqual(['a1'])
  })

  it('nunca toca num alerta adiado para o futuro, mesmo que a condição continue ou pare', () => {
    const adiado = existente({ estado: 'Adiado', adiadoAte: '2026-03-20' })
    const condicaoContinua = reconciliarAlertas(
      [adiado],
      [{ regraChave: 'lead_sem_contacto', severidade: 'Atenção', titulo: 'x', estudioId: 1, leadId: 'l1' }],
      '2026-03-05'
    )
    expect(condicaoContinua.paraCriar).toHaveLength(0)
    expect(condicaoContinua.paraReabrir).toHaveLength(0)

    const condicaoParou = reconciliarAlertas([adiado], [], '2026-03-05')
    expect(condicaoParou.paraResolver).toHaveLength(0)
  })

  it('reabre (volta a Novo) um alerta adiado cuja data já passou, se a condição ainda se verifica', () => {
    const adiadoVencido = existente({ estado: 'Adiado', adiadoAte: '2026-03-01' })
    const r = reconciliarAlertas(
      [adiadoVencido],
      [{ regraChave: 'lead_sem_contacto', severidade: 'Atenção', titulo: 'x', estudioId: 1, leadId: 'l1' }],
      '2026-03-05'
    )
    expect(r.paraReabrir).toEqual(['a1'])
    expect(r.paraCriar).toHaveLength(0)
  })

  it('muda o texto de um alerta aberto quando a situação muda, sem o duplicar', () => {
    const aberto = existente({ regraChave: 'cliente_sem_treino_agendado', leadId: null, clienteId: 'c1', estado: 'Visto', titulo: 'Bruno: ativo sem treinos marcados para a semana que vem' })
    const candidato = { regraChave: 'cliente_sem_treino_agendado', severidade: 'Crítico' as const, titulo: 'Bruno: ativo sem treinos nesta semana', estudioId: 1, clienteId: 'c1' }
    const r = reconciliarAlertas([aberto], [candidato], '2026-03-09')
    expect(r.paraCriar).toHaveLength(0)
    expect(r.paraResolver).toHaveLength(0)
    expect(r.paraRetitular).toEqual([{ id: 'a1', titulo: 'Bruno: ativo sem treinos nesta semana' }])
    // Mesmo texto: não mexe.
    expect(reconciliarAlertas([{ ...aberto, titulo: candidato.titulo }], [candidato], '2026-03-09').paraRetitular).toEqual([])
  })

  it('cria um novo alerta quando a mesma regra+entidade já tinha sido resolvida antes', () => {
    const resolvido = existente({ estado: 'Resolvido' })
    const r = reconciliarAlertas(
      [resolvido],
      [{ regraChave: 'lead_sem_contacto', severidade: 'Crítico', titulo: 'x', estudioId: 1, leadId: 'l1' }],
      '2026-03-05'
    )
    expect(r.paraCriar).toHaveLength(1)
  })
})
