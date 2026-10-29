import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'
import { somarDias } from '@/lib/data/horarios'
import {
  avaliarLeads,
  avaliarClientes,
  reconciliarAlertas,
  LIMITES_OMISSAO,
  type LeadParaAlertas,
  type ClienteParaAlertas,
  type AlertaExistente,
  type AlertaCandidato,
} from '@/lib/data/alertas'

// Corre agendado (ver .github/workflows/alertas.yml), mesmo padrão dos
// outros crons desta app. Protegido por CRON_SECRET.
export const dynamic = 'force-dynamic'

// Regras que, por área, só interessam a um papel específico — as
// restantes ficam visíveis só para quem gere o estúdio (admin/
// studio_manager), que já vê tudo independentemente disto. O PT, por
// pedido da especificação, só vê "mensalidade em atraso".
const PAPEL_POR_REGRA: Record<string, string> = {
  lead_sem_contacto: 'comercial',
  lead_sem_seguimento: 'comercial',
  experimental_amanha: 'comercial',
  experimental_falhada_sem_reagendar: 'comercial',
  experimental_sem_decisao: 'comercial',
  mensalidade_em_atraso: 'pt',
}

// Aproximação de "acumuladas" sem uma janela fixa na especificação:
// desmarcações dentro dos últimos 60 dias.
const JANELA_DESMARCACOES_DIAS = 60

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const agoraISO = new Date().toISOString()
  const hojeISO = agoraISO.slice(0, 10)
  const limiteDesmarcacoes = somarDias(hojeISO, -JANELA_DESMARCACOES_DIAS)

  const estudios = await getEstudios(admin)
  const estudioIds = estudios.map((e) => e.id)
  if (estudioIds.length === 0) {
    return Response.json({ ok: true, criados: 0, resolvidos: 0, reabertos: 0 })
  }

  const [
    { data: leadsData, error: erroLeads },
    { data: historicoData, error: erroHistorico },
    { data: clientesData, error: erroClientes },
    { data: eventosData, error: erroEventos },
    { data: presencasData, error: erroPresencas },
    { data: avaliacoesData, error: erroAvaliacoes },
    { data: pagamentosData, error: erroPagamentos },
    { data: regrasData, error: erroRegras },
    { data: alertasAbertosData, error: erroAlertasAbertos },
  ] = await Promise.all([
    admin
      .from('leads')
      .select('id, estudio_id, nome, estado, proximo_contacto, visita_data, visita_hora')
      .in('estudio_id', estudioIds),
    admin.from('lead_stage_history').select('lead_id, criado_em'),
    admin
      .from('clientes')
      .select('id, estudio_id, nome, nascimento, fim_experiencia')
      .eq('estado', 'Ativo')
      .in('estudio_id', estudioIds),
    admin.from('agenda_eventos').select('cliente_id, data, estado, tipo').eq('tipo', 'Treino'),
    admin.from('presencas').select('cliente_id, data, estado').order('data', { ascending: false }),
    admin.from('avaliacoes').select('cliente_id, data, proxima_reavaliacao').order('data', { ascending: false }),
    admin.from('pagamentos').select('cliente_id, valido_ate'),
    admin.from('alert_rules').select('chave, ativo'),
    admin.from('alerts').select('id, regra_chave, lead_id, cliente_id, estado, adiado_ate'),
  ])

  for (const [area, erro] of [
    ['leads', erroLeads],
    ['historico', erroHistorico],
    ['clientes', erroClientes],
    ['eventos', erroEventos],
    ['presencas', erroPresencas],
    ['avaliacoes', erroAvaliacoes],
    ['pagamentos', erroPagamentos],
    ['regras', erroRegras],
    ['alertas', erroAlertasAbertos],
  ] as const) {
    if (erro) return Response.json({ error: `${area}: ${erro.message}` }, { status: 500 })
  }

  // --- Preparar dados das leads ---
  const historicoPorLead = new Map<string, { min: string; max: string }>()
  for (const h of historicoData ?? []) {
    const atual = historicoPorLead.get(h.lead_id)
    if (!atual) {
      historicoPorLead.set(h.lead_id, { min: h.criado_em, max: h.criado_em })
    } else {
      if (h.criado_em < atual.min) atual.min = h.criado_em
      if (h.criado_em > atual.max) atual.max = h.criado_em
    }
  }
  const leadsParaAlertas: LeadParaAlertas[] = (leadsData ?? []).map((l) => {
    const hist = historicoPorLead.get(l.id)
    return {
      id: l.id,
      estudio_id: l.estudio_id,
      nome: l.nome,
      estado: l.estado,
      proximo_contacto: l.proximo_contacto,
      visita_data: l.visita_data,
      visita_hora: l.visita_hora,
      criado_em: hist?.min ?? agoraISO,
      ultima_atividade_em: hist?.max ?? agoraISO,
    }
  })

  // --- Preparar dados dos clientes ---
  const clientesComTreinoFuturo = new Set(
    (eventosData ?? [])
      .filter((e) => e.estado === 'Agendado' && e.data >= hojeISO && e.cliente_id)
      .map((e) => e.cliente_id as string)
  )

  const presencasPorCliente = new Map<string, { data: string; estado: string }[]>()
  for (const p of presencasData ?? []) {
    const lista = presencasPorCliente.get(p.cliente_id) ?? []
    lista.push(p)
    presencasPorCliente.set(p.cliente_id, lista)
  }

  const reavaliacaoPorCliente = new Map<string, string | null>()
  for (const a of avaliacoesData ?? []) {
    if (!reavaliacaoPorCliente.has(a.cliente_id)) {
      reavaliacaoPorCliente.set(a.cliente_id, a.proxima_reavaliacao)
    }
  }

  // Mesma lógica de "v_estado_pagamento", mas calculada aqui: essa view
  // chama tenho_estudio() no próprio corpo, que depende de auth.uid() —
  // com o cliente de serviço (sem sessão) isso dá sempre falso, logo a
  // view devolve sempre 0 linhas. A tabela "pagamentos" em si não tem
  // esse problema (RLS é mesmo ignorado pelo serviço).
  const validoAtePorCliente = new Map<string, string>()
  for (const p of pagamentosData ?? []) {
    const atual = validoAtePorCliente.get(p.cliente_id)
    if (!atual || p.valido_ate > atual) validoAtePorCliente.set(p.cliente_id, p.valido_ate)
  }

  const clientesParaAlertas: ClienteParaAlertas[] = (clientesData ?? []).map((c) => {
    const presencas = presencasPorCliente.get(c.id) ?? []
    let consecutivas = 0
    for (const p of presencas) {
      if (p.estado === 'Remarcado') consecutivas++
      else break
    }
    const acumuladas = presencas.filter((p) => p.data >= limiteDesmarcacoes && p.estado === 'Remarcado').length
    const validoAte = validoAtePorCliente.get(c.id) ?? null

    return {
      id: c.id,
      estudio_id: c.estudio_id,
      nome: c.nome,
      nascimento: c.nascimento,
      fim_experiencia: c.fim_experiencia,
      tem_treino_agendado: clientesComTreinoFuturo.has(c.id),
      desmarcacoes_consecutivas: consecutivas,
      desmarcacoes_acumuladas: acumuladas,
      proxima_reavaliacao: reavaliacaoPorCliente.get(c.id) ?? null,
      em_dia: validoAte !== null && validoAte >= hojeISO,
      valido_ate: validoAte,
    }
  })

  // --- Avaliar regras (só as ativas em alert_rules) ---
  const regrasAtivas = new Set((regrasData ?? []).filter((r) => r.ativo).map((r) => r.chave))
  const candidatos = [
    ...avaliarLeads(leadsParaAlertas, agoraISO, LIMITES_OMISSAO),
    ...avaliarClientes(clientesParaAlertas, hojeISO, LIMITES_OMISSAO),
  ].filter((c) => regrasAtivas.has(c.regraChave))

  // --- Reconciliar com o que já está na tabela "alerts" ---
  const existentes: AlertaExistente[] = (alertasAbertosData ?? []).map((a) => ({
    id: a.id,
    regraChave: a.regra_chave,
    leadId: a.lead_id,
    clienteId: a.cliente_id,
    estado: a.estado,
    adiadoAte: a.adiado_ate,
  }))
  const { paraCriar, paraResolver, paraReabrir } = reconciliarAlertas(existentes, candidatos, hojeISO)

  if (paraCriar.length > 0) {
    const linhas = paraCriar.map((c: AlertaCandidato) => ({
      estudio_id: c.estudioId,
      regra_chave: c.regraChave,
      severidade: c.severidade,
      titulo: c.titulo,
      lead_id: c.leadId ?? null,
      cliente_id: c.clienteId ?? null,
      papel_destinatario: PAPEL_POR_REGRA[c.regraChave] ?? null,
    }))
    const { error } = await admin.from('alerts').insert(linhas)
    if (error) return Response.json({ error: `criar: ${error.message}` }, { status: 500 })
  }

  if (paraResolver.length > 0) {
    const { error } = await admin
      .from('alerts')
      .update({ estado: 'Resolvido', resolvido_em: agoraISO, atualizado_em: agoraISO })
      .in('id', paraResolver)
    if (error) return Response.json({ error: `resolver: ${error.message}` }, { status: 500 })
  }

  if (paraReabrir.length > 0) {
    const { error } = await admin
      .from('alerts')
      .update({ estado: 'Novo', atualizado_em: agoraISO })
      .in('id', paraReabrir)
    if (error) return Response.json({ error: `reabrir: ${error.message}` }, { status: 500 })
  }

  return Response.json({
    ok: true,
    criados: paraCriar.length,
    resolvidos: paraResolver.length,
    reabertos: paraReabrir.length,
  })
}
