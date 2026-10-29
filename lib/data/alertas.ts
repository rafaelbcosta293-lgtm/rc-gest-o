// Motor de alertas (secção 5 da especificação): regras puras, sem
// acesso à base de dados, para poderem ser testadas isoladamente — a
// rota de cron (app/api/cron/alertas) só faz a leitura/escrita e chama
// estas funções com os dados já preparados.
//
// Nunca inclui valores em € nas descrições (regra de ouro já aplicada
// em toda a timeline de atividades) — "mensalidade em atraso" nunca
// diz quanto, "plano a expirar" nunca diz o valor do plano.

export type SeveridadeAlerta = 'Info' | 'Atenção' | 'Crítico'

export type AlertaCandidato = {
  regraChave: string
  severidade: SeveridadeAlerta
  titulo: string
  estudioId: number
  leadId?: string | null
  clienteId?: string | null
}

export type LimitesAlertas = {
  horasSemContactoAtencao: number
  horasSemContactoCritico: number
  diasSemSeguimento: number
  horasExperimentalFalhada: number
  diasExperimentalSemDecisao: number
  desmarcacoesConsecutivas: number
  desmarcacoesAcumuladas: number
  diasFimExperiencia: number
  diasReavaliacaoProxima: number
  diaMesMensalidadeAtraso: number
  diasPlanoAExpirar: number
}

export const LIMITES_OMISSAO: LimitesAlertas = {
  horasSemContactoAtencao: 2,
  horasSemContactoCritico: 24,
  diasSemSeguimento: 3,
  horasExperimentalFalhada: 48,
  diasExperimentalSemDecisao: 5,
  desmarcacoesConsecutivas: 2,
  desmarcacoesAcumuladas: 5,
  diasFimExperiencia: 7,
  diasReavaliacaoProxima: 14,
  diaMesMensalidadeAtraso: 8,
  diasPlanoAExpirar: 7,
}

function diasEntre(deISO: string, paraISO: string): number {
  return Math.round(
    (new Date(`${paraISO}T00:00:00Z`).getTime() - new Date(`${deISO}T00:00:00Z`).getTime()) / 86_400_000
  )
}

export type LeadParaAlertas = {
  id: string
  estudio_id: number
  nome: string
  estado: string
  proximo_contacto: string | null
  visita_data: string | null
  visita_hora: string | null
  // Timestamps vindos de lead_stage_history: a primeira linha (criação)
  // e a mais recente de todas (última mudança, usada como "última
  // atividade" para as regras de inatividade).
  criado_em: string
  ultima_atividade_em: string
}

export function avaliarLeads(
  leads: LeadParaAlertas[],
  agoraISO: string,
  limites: LimitesAlertas = LIMITES_OMISSAO
): AlertaCandidato[] {
  const agora = new Date(agoraISO).getTime()
  const hojeISO = agoraISO.slice(0, 10)
  const amanhaISO = new Date(new Date(`${hojeISO}T00:00:00Z`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10)
  const candidatos: AlertaCandidato[] = []

  for (const l of leads) {
    if (l.estado === 'Ganha' || l.estado === 'Perdida') continue

    if (l.estado === 'Nova') {
      const horas = (agora - new Date(l.criado_em).getTime()) / 3_600_000
      if (horas >= limites.horasSemContactoCritico) {
        candidatos.push({
          regraChave: 'lead_sem_contacto',
          severidade: 'Crítico',
          titulo: `${l.nome}: sem contacto há mais de ${limites.horasSemContactoCritico}h`,
          estudioId: l.estudio_id,
          leadId: l.id,
        })
      } else if (horas >= limites.horasSemContactoAtencao) {
        candidatos.push({
          regraChave: 'lead_sem_contacto',
          severidade: 'Atenção',
          titulo: `${l.nome}: sem contacto há mais de ${limites.horasSemContactoAtencao}h`,
          estudioId: l.estudio_id,
          leadId: l.id,
        })
      }
    }

    const diasSemAtividade = (agora - new Date(l.ultima_atividade_em).getTime()) / 86_400_000
    const acaoVencida = l.proximo_contacto !== null && l.proximo_contacto < hojeISO
    if (acaoVencida || diasSemAtividade > limites.diasSemSeguimento) {
      candidatos.push({
        regraChave: 'lead_sem_seguimento',
        severidade: 'Crítico',
        titulo: acaoVencida ? `${l.nome}: próxima ação vencida` : `${l.nome}: sem seguimento há mais de ${limites.diasSemSeguimento} dias`,
        estudioId: l.estudio_id,
        leadId: l.id,
      })
    }

    if (l.estado === 'Experimental agendada' && l.visita_data === amanhaISO) {
      candidatos.push({
        regraChave: 'experimental_amanha',
        severidade: 'Atenção',
        titulo: `${l.nome}: experimental amanhã${l.visita_hora ? ` às ${l.visita_hora.slice(0, 5)}` : ''}`,
        estudioId: l.estudio_id,
        leadId: l.id,
      })
    }

    if (l.estado === 'Falhou a experimental') {
      const horas = (agora - new Date(l.ultima_atividade_em).getTime()) / 3_600_000
      if (horas >= limites.horasExperimentalFalhada) {
        candidatos.push({
          regraChave: 'experimental_falhada_sem_reagendar',
          severidade: 'Crítico',
          titulo: `${l.nome}: experimental falhada sem reagendamento`,
          estudioId: l.estudio_id,
          leadId: l.id,
        })
      }
    }

    if (l.estado === 'Experimental realizada') {
      const dias = (agora - new Date(l.ultima_atividade_em).getTime()) / 86_400_000
      if (dias >= limites.diasExperimentalSemDecisao) {
        candidatos.push({
          regraChave: 'experimental_sem_decisao',
          severidade: 'Atenção',
          titulo: `${l.nome}: experimental realizada sem decisão`,
          estudioId: l.estudio_id,
          leadId: l.id,
        })
      }
    }
  }

  return candidatos
}

export type ClienteParaAlertas = {
  id: string
  estudio_id: number
  nome: string
  nascimento: string | null
  fim_experiencia: string | null
  tem_treino_agendado: boolean
  desmarcacoes_consecutivas: number
  desmarcacoes_acumuladas: number
  proxima_reavaliacao: string | null
  em_dia: boolean
  valido_ate: string | null
}

function ehAniversarioHoje(nascimentoISO: string, hojeISO: string): boolean {
  return nascimentoISO.slice(5, 10) === hojeISO.slice(5, 10)
}

export function avaliarClientes(
  clientes: ClienteParaAlertas[],
  hojeISO: string,
  limites: LimitesAlertas = LIMITES_OMISSAO
): AlertaCandidato[] {
  const candidatos: AlertaCandidato[] = []

  for (const c of clientes) {
    if (!c.tem_treino_agendado) {
      candidatos.push({
        regraChave: 'cliente_sem_treino_agendado',
        severidade: 'Crítico',
        titulo: `${c.nome}: ativo sem treino agendado`,
        estudioId: c.estudio_id,
        clienteId: c.id,
      })
    }

    if (
      c.desmarcacoes_consecutivas >= limites.desmarcacoesConsecutivas ||
      c.desmarcacoes_acumuladas >= limites.desmarcacoesAcumuladas
    ) {
      candidatos.push({
        regraChave: 'cliente_limite_desmarcacoes',
        severidade: 'Atenção',
        titulo: `${c.nome}: perto do limite de desmarcações`,
        estudioId: c.estudio_id,
        clienteId: c.id,
      })
    }

    if (c.fim_experiencia) {
      const dias = diasEntre(hojeISO, c.fim_experiencia)
      if (dias >= 0 && dias <= limites.diasFimExperiencia) {
        candidatos.push({
          regraChave: 'fim_experiencia_proximo',
          severidade: 'Atenção',
          titulo: `${c.nome}: experiência termina em ${dias} dia(s)`,
          estudioId: c.estudio_id,
          clienteId: c.id,
        })
      }
    }

    if (c.proxima_reavaliacao) {
      const dias = diasEntre(hojeISO, c.proxima_reavaliacao)
      if (dias < 0) {
        candidatos.push({
          regraChave: 'reavaliacao_atrasada',
          severidade: 'Atenção',
          titulo: `${c.nome}: reavaliação atrasada`,
          estudioId: c.estudio_id,
          clienteId: c.id,
        })
      } else if (dias <= limites.diasReavaliacaoProxima) {
        candidatos.push({
          regraChave: 'reavaliacao_proxima',
          severidade: 'Info',
          titulo: `${c.nome}: reavaliação em ${dias} dia(s)`,
          estudioId: c.estudio_id,
          clienteId: c.id,
        })
      }
    }

    if (c.nascimento && ehAniversarioHoje(c.nascimento, hojeISO)) {
      candidatos.push({
        regraChave: 'aniversario_hoje',
        severidade: 'Info',
        titulo: `${c.nome}: faz anos hoje`,
        estudioId: c.estudio_id,
        clienteId: c.id,
      })
    }

    if (!c.em_dia && Number(hojeISO.slice(8, 10)) > limites.diaMesMensalidadeAtraso) {
      candidatos.push({
        regraChave: 'mensalidade_em_atraso',
        severidade: 'Crítico',
        titulo: `${c.nome}: mensalidade em atraso`,
        estudioId: c.estudio_id,
        clienteId: c.id,
      })
    }

    if (c.valido_ate) {
      const dias = diasEntre(hojeISO, c.valido_ate)
      if (dias >= 0 && dias <= limites.diasPlanoAExpirar) {
        candidatos.push({
          regraChave: 'plano_a_expirar',
          severidade: 'Atenção',
          titulo: `${c.nome}: plano a expirar em ${dias} dia(s)`,
          estudioId: c.estudio_id,
          clienteId: c.id,
        })
      }
    }
  }

  return candidatos
}

export type AlertaExistente = {
  id: string
  regraChave: string | null
  leadId: string | null
  clienteId: string | null
  estado: 'Novo' | 'Visto' | 'Resolvido' | 'Adiado'
  adiadoAte: string | null
}

export type ReconciliacaoAlertas = {
  paraCriar: AlertaCandidato[]
  paraResolver: string[]
  paraReabrir: string[]
}

function chaveAlerta(a: { regraChave: string | null; leadId?: string | null; clienteId?: string | null }) {
  return `${a.regraChave ?? ''}:${a.leadId ?? ''}:${a.clienteId ?? ''}`
}

// Nunca duplica um alerta já aberto para a mesma regra+lead/cliente,
// resolve automaticamente o que deixou de se verificar, e nunca toca
// num alerta adiado para uma data futura — é isso que "adiar" significa.
export function reconciliarAlertas(
  existentes: AlertaExistente[],
  candidatos: AlertaCandidato[],
  hojeISO: string
): ReconciliacaoAlertas {
  const adiadosNoFuturo = new Set(
    existentes.filter((e) => e.estado === 'Adiado' && e.adiadoAte && e.adiadoAte > hojeISO).map(chaveAlerta)
  )

  const consideraveis = existentes.filter((e) => !adiadosNoFuturo.has(chaveAlerta(e)))
  const ativos = consideraveis.filter((e) => e.estado !== 'Resolvido')
  const chavesAtivas = new Set(ativos.map(chaveAlerta))
  const candidatosPorChave = new Map(candidatos.map((c) => [chaveAlerta(c), c]))

  const paraCriar = candidatos.filter(
    (c) => !adiadosNoFuturo.has(chaveAlerta(c)) && !chavesAtivas.has(chaveAlerta(c))
  )
  const paraResolver = ativos.filter((e) => !candidatosPorChave.has(chaveAlerta(e))).map((e) => e.id)
  const paraReabrir = ativos
    .filter((e) => e.estado === 'Adiado' && candidatosPorChave.has(chaveAlerta(e)))
    .map((e) => e.id)

  return { paraCriar, paraResolver, paraReabrir }
}
