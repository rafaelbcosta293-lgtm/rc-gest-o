'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { gerarOcorrencias, eventoJaTerminou, type LimiteRepeticao, type Repeticao } from '@/lib/data/agenda'
import type { TipoEventoAgenda } from '@/lib/supabase/database.types'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

type LinhaParaReconciliar = { id: string; cliente_id: string | null; data: string; pt_id: string | null }

// Agendar uma "Sessão experimental" a partir da Agenda também avança a
// lead no funil — mesmo efeito que o botão "Agendar experimental" já
// tinha na própria ficha da lead (ver agendarExperimental em
// leads/actions.ts), para o painel de Coordenação (que lê visita_data/
// visita_hora da lead, não a Agenda) nunca ficar dessincronizado,
// seja qual for o sítio onde a sessão foi marcada.
async function sincronizarVisitaLead(
  supabase: SupabaseClient,
  leadId: string | null,
  data: string,
  horaInicio: string
) {
  if (!leadId) return null
  const hoje = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('leads')
    .update({
      visita_data: data,
      visita_hora: horaInicio,
      visita_marcada_em: hoje,
      estado: 'Experimental agendada',
    })
    .eq('id', leadId)
  return error?.message ?? null
}

// Mantém a ficha de presenças do cliente a bater certo com o estado do
// evento, mesmo que a alteração aconteça muito depois (ex.: desmarcar
// no dia seguinte um treino que o cron já tinha contado como presença).
// Ligado ao evento por "agenda_evento_id" (nunca mexe numa presença
// marcada à mão nem numa vinda do Google Calendar).
async function reconciliarPresencasDoEvento(
  supabase: SupabaseClient,
  linhas: LinhaParaReconciliar[],
  contarComoRealizado: boolean
): Promise<string | null> {
  for (const linha of linhas) {
    if (!contarComoRealizado) {
      // Não precisa do cliente_id — apaga só pelo evento, nunca uma
      // presença marcada à mão nem vinda do Google Calendar.
      const { error } = await supabase
        .from('presencas')
        .delete()
        .eq('agenda_evento_id', linha.id)
        .eq('origem', 'agenda')
      if (error) return error.message
      continue
    }

    if (!linha.cliente_id) continue // reunião/outro, sem cliente — nada a marcar

    const { data: existente, error: erroExistente } = await supabase
      .from('presencas')
      .select('id, origem')
      .eq('cliente_id', linha.cliente_id)
      .eq('data', linha.data)
      .maybeSingle()
    if (erroExistente) return erroExistente.message

    if (!existente) {
      const { error } = await supabase.from('presencas').insert({
        cliente_id: linha.cliente_id,
        data: linha.data,
        estado: 'Presente',
        pt_id: linha.pt_id,
        origem: 'agenda',
        agenda_evento_id: linha.id,
      })
      if (error) return error.message
    } else if (existente.origem === 'agenda') {
      const { error } = await supabase
        .from('presencas')
        .update({ estado: 'Presente', agenda_evento_id: linha.id })
        .eq('id', existente.id)
      if (error) return error.message
    }
    // Já havia um registo manual (ou do calendário) para este dia —
    // nunca se mexe nele.
  }
  return null
}

type EventoParaLimparVisita = { lead_id: string | null; data: string; hora_inicio: string }

// Ao apagar um evento de "Sessão experimental" ligado a uma lead, essa
// lead não pode continuar a mostrar uma visita agendada para um evento
// que já não existe. Só limpa quando a data/hora batem mesmo com o que
// está guardado na lead — nunca mexe se a visita entretanto já foi
// remarcada para outro evento (nessa altura já não bate certo).
async function limparVisitaLeadsApagadas(
  supabase: SupabaseClient,
  eventos: EventoParaLimparVisita[]
): Promise<string | null> {
  const leadIds = [...new Set(eventos.map((e) => e.lead_id).filter((id): id is string => !!id))]
  if (leadIds.length === 0) return null

  const { data: leadsData, error: erroLeads } = await supabase
    .from('leads')
    .select('id, visita_data, visita_hora')
    .in('id', leadIds)
  if (erroLeads) return erroLeads.message

  for (const evento of eventos) {
    if (!evento.lead_id) continue
    const lead = leadsData?.find((l) => l.id === evento.lead_id)
    if (!lead || !lead.visita_data) continue
    const horaBate = lead.visita_hora?.slice(0, 5) === evento.hora_inicio.slice(0, 5)
    if (lead.visita_data !== evento.data || !horaBate) continue

    const { error } = await supabase
      .from('leads')
      .update({ visita_data: null, visita_hora: null, visita_marcada_em: null })
      .eq('id', evento.lead_id)
    if (error) return error.message
  }
  return null
}

// Depois de mover/redimensionar um evento (arrastar na grelha), relê a(s)
// linha(s) já atualizada(s) — por isso já com o dia/hora novos — e, se
// for uma Sessão experimental ligada a uma lead, atualiza a visita
// guardada nela para continuar a bater certo com o evento.
async function sincronizarVisitasLeadsAposMover(
  supabase: SupabaseClient,
  filtro: { grupoId: string | null; id: string }
): Promise<string | null> {
  const query = supabase.from('agenda_eventos').select('lead_id, data, hora_inicio')
  const { data: linhas, error } = filtro.grupoId
    ? await query.eq('grupo_id', filtro.grupoId)
    : await query.eq('id', filtro.id)
  if (error) return error.message

  for (const linha of linhas ?? []) {
    if (!linha.lead_id) continue
    const erro = await sincronizarVisitaLead(supabase, linha.lead_id, linha.data, linha.hora_inicio)
    if (erro) return erro
  }
  return null
}

export async function criarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const tipo = formData.get('tipo') as TipoEventoAgenda
  const clienteId = campoOuNull(formData, 'cliente_id')
  const ptId = campoOuNull(formData, 'pt_id')
  const titulo = campoOuNull(formData, 'titulo')
  const leadId = campoOuNull(formData, 'lead_id')
  const telefone = campoOuNull(formData, 'telefone')
  const data = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const duracaoMin = Number(formData.get('duracao_min')) || 40
  const nota = campoOuNull(formData, 'nota')
  const repeticao = (formData.get('repeticao') as Repeticao) || 'nao'
  const limiteModo = (formData.get('limite_modo') as string) || 'vezes'
  const repeteAte = campoOuNull(formData, 'repete_ate')
  const repeteVezes = campoOuNull(formData, 'repete_vezes')

  if (!data || !horaInicio) {
    redirect(
      `/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent('Data e hora são obrigatórias.')}`
    )
  }

  const sessao = await getSessaoAtual()
  const supabase = await createClient()

  const limite: LimiteRepeticao =
    limiteModo === 'indefinido'
      ? { modo: 'indefinido' }
      : limiteModo === 'ate' && repeteAte
        ? { modo: 'ate', ate: repeteAte }
        : { modo: 'vezes', vezes: repeteVezes ? Number(repeteVezes) : 8 }

  const ocorrencias = gerarOcorrencias(data, repeticao, limite)

  // Uma série indefinida precisa de um modelo em agenda_series, para o
  // cron saber como continuar a gerá-la depois desta janela inicial —
  // as de duração definida (até data/N vezes) continuam sem ele, tal
  // como antes.
  let serieId: string | null = null
  if (repeticao !== 'nao' && limite.modo === 'indefinido') {
    const { data: serie, error: erroSerie } = await supabase
      .from('agenda_series')
      .insert({
        estudio_id: estudioId,
        cliente_id: clienteId,
        pt_id: ptId,
        tipo,
        titulo,
        hora_inicio: horaInicio,
        duracao_min: duracaoMin,
        repeticao,
        nota,
        criado_por: sessao.userId,
      })
      .select('id')
      .single()
    if (erroSerie || !serie) {
      redirect(
        `/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent(erroSerie?.message ?? 'Não foi possível criar a série.')}`
      )
    }
    serieId = serie.id
  } else if (ocorrencias.length > 1) {
    serieId = randomUUID()
  }

  const linhas = ocorrencias.map((dataOcorrencia) => ({
    estudio_id: estudioId,
    cliente_id: clienteId,
    pt_id: ptId,
    tipo,
    titulo,
    lead_id: leadId,
    telefone,
    data: dataOcorrencia,
    hora_inicio: horaInicio,
    duracao_min: duracaoMin,
    serie_id: serieId,
    nota,
    criado_por: sessao.userId,
  }))

  const { error } = await supabase.from('agenda_eventos').insert(linhas)

  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent(error.message)}`)
  }

  if (tipo === 'Sessão experimental') {
    const erroLead = await sincronizarVisitaLead(supabase, leadId, data, horaInicio)
    if (erroLead) {
      redirect(`/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent(erroLead)}`)
    }
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda?vista=dia&data=${data}`)
}

export async function atualizarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const tipo = formData.get('tipo') as TipoEventoAgenda
  const clienteId = campoOuNull(formData, 'cliente_id')
  const ptId = campoOuNull(formData, 'pt_id')
  const titulo = campoOuNull(formData, 'titulo')
  const leadId = campoOuNull(formData, 'lead_id')
  const telefone = campoOuNull(formData, 'telefone')
  const data = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const duracaoMin = Number(formData.get('duracao_min')) || 40
  const nota = campoOuNull(formData, 'nota')
  const supabase = await createClient()

  // Se o dia ou a hora mudarem depois de o lembrete já ter sido
  // enviado, esse SMS ficou a falar de um treino que já não existe
  // (ou já foi enviado para a data errada) — sem repor isto a app
  // nunca mais avisa, porque o lembrete já conta como "enviado" para
  // sempre, mesmo sendo para outro dia.
  const { data: eventoAtual, error: erroAtual } = await supabase
    .from('agenda_eventos')
    .select('data, hora_inicio, lembrete_enviado')
    .eq('id', id)
    .maybeSingle()
  if (erroAtual) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroAtual.message)}`)
  }
  const mudouQuandoOuHora =
    !!eventoAtual &&
    (eventoAtual.data !== data || eventoAtual.hora_inicio.slice(0, 5) !== horaInicio.slice(0, 5))
  const repoeLembrete = eventoAtual?.lembrete_enviado === true && mudouQuandoOuHora

  // Só afeta esta linha (uma ocorrência) — nunca o resto da série,
  // mesmo que serie_id esteja preenchido.
  const { error } = await supabase
    .from('agenda_eventos')
    .update({
      tipo,
      cliente_id: clienteId,
      pt_id: ptId,
      titulo,
      lead_id: leadId,
      telefone,
      data,
      hora_inicio: horaInicio,
      duracao_min: duracaoMin,
      nota,
      ...(repoeLembrete ? { lembrete_enviado: false, lembrete_enviado_em: null } : {}),
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
  }

  // Mudar o dia/hora de uma Sessão experimental tem de se refletir logo
  // na lead associada — senão ela fica a mostrar uma visita para um
  // dia/hora que já não é o do evento (ver sincronizarVisitaLead).
  if (tipo === 'Sessão experimental') {
    const erroLead = await sincronizarVisitaLead(supabase, leadId, data, horaInicio)
    if (erroLead) {
      redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroLead)}`)
    }
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda/${id}`)
}

// Para uma série indefinida de vez — "interromper", distinto de
// desmarcar/apagar uma única ocorrência: marca a série como inativa (o
// cron deixa de a estender) e cancela (nunca apaga — fica no histórico)
// as ocorrências futuras que ainda estivessem agendadas. O que já
// aconteceu, ou já tinha sido desmarcado/apagado à parte, não muda.
export async function pararSerie(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const serieId = formData.get('serie_id') as string
  const supabase = await createClient()

  const { error: erroSerie } = await supabase.from('agenda_series').update({ ativa: false }).eq('id', serieId)
  if (erroSerie) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroSerie.message)}`)
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const { error: erroCancelar } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Cancelado', motivo_cancelamento: 'Série interrompida' })
    .eq('serie_id', serieId)
    .eq('estado', 'Agendado')
    .gte('data', hoje)
  if (erroCancelar) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroCancelar.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda/${id}`)
}

export async function desmarcarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const motivo = campoOuNull(formData, 'motivo_cancelamento')
  const contarComoRealizado = formData.get('conta_como_realizado') === 'sim'
  const foiRemarcado = formData.get('foi_remarcado') === 'sim'
  const supabase = await createClient()

  const { data: linhaData, error: erroLinha } = await supabase
    .from('agenda_eventos')
    .select('id, cliente_id, data, pt_id')
    .eq('id', id)
    .maybeSingle()
  if (erroLinha || !linhaData) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroLinha?.message ?? 'Evento não encontrado.')}`)
  }

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Cancelado', motivo_cancelamento: motivo, foi_remarcado: foiRemarcado })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
  }

  const erroReconciliar = await reconciliarPresencasDoEvento(supabase, [linhaData], contarComoRealizado)
  if (erroReconciliar) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroReconciliar)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda/${id}`)
}

// Permite corrigir mais tarde se uma desmarcação já foi remarcada —
// muitas vezes só se sabe dias depois, quando o cliente volta a
// marcar, e nessa altura já não se está no fluxo de desmarcar.
export async function atualizarRemarcacao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const foiRemarcado = formData.get('foi_remarcado') === 'sim'
  const supabase = await createClient()

  const { error } = await supabase.from('agenda_eventos').update({ foi_remarcado: foiRemarcado }).eq('id', id)
  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda/${id}`)
}

export async function reativarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Agendado', motivo_cancelamento: null, foi_remarcado: false })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
  }

  // Volta a "Agendado" — deixa de estar concluído/cancelado, por isso
  // desfaz a presença que a agenda tivesse criado (só essa, nunca uma
  // marcada à mão); o cron volta a contá-la quando o evento terminar.
  const erroReconciliar = await reconciliarPresencasDoEvento(
    supabase,
    [{ id, cliente_id: null, data: '', pt_id: null }],
    false
  )
  if (erroReconciliar) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroReconciliar)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda/${id}`)
}

// Âmbito ao apagar um evento de uma série repetida — "um" é só esta
// ocorrência (o de sempre); os outros três apagam mesmo um intervalo
// de ocorrências (ao contrário de pararSerie, que só cancela e guarda
// o histórico), filtrando pelo serie_id partilhado por toda a série.
export type EscopoApagar = 'um' | 'seguintes' | 'anteriores' | 'serie'

export async function apagarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const data = formData.get('data') as string
  const serieId = campoOuNull(formData, 'serie_id')
  const escopo = ((formData.get('escopo') as string) || 'um') as EscopoApagar
  const supabase = await createClient()

  let selecao = supabase.from('agenda_eventos').select('id, lead_id, data, hora_inicio')
  if (escopo !== 'um' && serieId) {
    selecao = selecao.eq('serie_id', serieId)
    if (escopo === 'seguintes') selecao = selecao.gte('data', data)
    else if (escopo === 'anteriores') selecao = selecao.lte('data', data)
  } else {
    selecao = selecao.eq('id', id)
  }
  const { data: eventosParaApagar, error: erroLer } = await selecao
  if (erroLer) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroLer.message)}`)
  }

  const erroLimpar = await limparVisitaLeadsApagadas(supabase, eventosParaApagar ?? [])
  if (erroLimpar) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroLimpar)}`)
  }

  const { error } = await supabase
    .from('agenda_eventos')
    .delete()
    .in('id', (eventosParaApagar ?? []).map((e) => e.id))

  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda?vista=dia&data=${data}`)
}

// Variantes "rápidas" das ações acima — chamadas diretamente (com
// argumentos normais, não FormData) pelo modal de edição embutido na
// própria agenda (AgendaInterativa.tsx). Nunca fazem redirect: devolvem
// um resultado para o componente cliente decidir o que mostrar e fechar
// o modal sem sair da página, mantendo o resto da agenda visível.
export type ResultadoAcaoRapida = { ok: true } | { error: string }

type CamposEvento = {
  estudioSlug: string
  tipo: TipoEventoAgenda
  // Um treino com várias pessoas em simultâneo guarda uma linha por
  // pessoa, todas com o mesmo grupo_id — vazio/[null] é "sem cliente"
  // (reunião/outro), uma entrada é o caso normal, várias é o treino
  // conjunto.
  clienteIds: string[]
  ptId: string | null
  titulo: string | null
  // Só para "Sessão experimental" — a pessoa ainda não é cliente.
  leadId: string | null
  telefone: string | null
  data: string
  horaInicio: string
  duracaoMin: number
  nota: string | null
}

export async function criarEventoRapido(
  input: CamposEvento & { estudioId: number; repeticao: Repeticao; limite: LimiteRepeticao }
): Promise<ResultadoAcaoRapida> {
  const sessao = await getSessaoAtual()
  const supabase = await createClient()

  const idsClientes: (string | null)[] = input.clienteIds.length > 0 ? input.clienteIds : [null]
  const ocorrencias = gerarOcorrencias(input.data, input.repeticao, input.limite)

  // Uma série indefinida precisa do modelo em agenda_series para o cron
  // a conseguir continuar — guarda só a primeira pessoa quando é um
  // treino em simultâneo (caso raro de combinar as duas coisas; para
  // grupos recorrentes, "N vezes" ou "até data" descrevem isto melhor).
  let serieId: string | null = null
  if (input.repeticao !== 'nao' && input.limite.modo === 'indefinido') {
    const { data: serie, error: erroSerie } = await supabase
      .from('agenda_series')
      .insert({
        estudio_id: input.estudioId,
        cliente_id: idsClientes.length === 1 ? idsClientes[0] : null,
        pt_id: input.ptId,
        tipo: input.tipo,
        titulo: input.titulo,
        hora_inicio: input.horaInicio,
        duracao_min: input.duracaoMin,
        repeticao: input.repeticao,
        nota: input.nota,
        criado_por: sessao.userId,
      })
      .select('id')
      .single()
    if (erroSerie || !serie) return { error: erroSerie?.message ?? 'Não foi possível criar a série.' }
    serieId = serie.id
  } else if (ocorrencias.length > 1) {
    serieId = randomUUID()
  }

  const linhas = ocorrencias.flatMap((dataOcorrencia) => {
    const grupoId = idsClientes.length > 1 ? randomUUID() : null
    return idsClientes.map((clienteId) => ({
      estudio_id: input.estudioId,
      cliente_id: clienteId,
      pt_id: input.ptId,
      tipo: input.tipo,
      titulo: input.titulo,
      lead_id: input.leadId,
      telefone: input.telefone,
      data: dataOcorrencia,
      hora_inicio: input.horaInicio,
      duracao_min: input.duracaoMin,
      grupo_id: grupoId,
      serie_id: serieId,
      nota: input.nota,
      criado_por: sessao.userId,
    }))
  })

  const { error } = await supabase.from('agenda_eventos').insert(linhas)
  if (error) return { error: error.message }

  if (input.tipo === 'Sessão experimental') {
    const erroLead = await sincronizarVisitaLead(supabase, input.leadId, input.data, input.horaInicio)
    if (erroLead) return { error: erroLead }
  }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function atualizarEventoRapido(
  input: CamposEvento & { id: string; grupoId: string | null; estudioId: number }
): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  // Linhas que hoje compõem este treino (só esta, ou todo o grupo
  // partilhado) — comparadas com a lista de pessoas pedida agora, para
  // saber quem sai (apagar), quem fica (atualizar) e quem entra (criar).
  const { data: atuaisData, error: erroAtuais } = input.grupoId
    ? await supabase
        .from('agenda_eventos')
        .select('id, cliente_id, lead_id, data, hora_inicio, estado')
        .eq('grupo_id', input.grupoId)
    : await supabase
        .from('agenda_eventos')
        .select('id, cliente_id, lead_id, data, hora_inicio, estado')
        .eq('id', input.id)
  if (erroAtuais) return { error: erroAtuais.message }
  const atuais = atuaisData ?? []

  const idsDesejados: (string | null)[] = input.clienteIds.length > 0 ? input.clienteIds : [null]
  const paraApagar = atuais.filter((a) => !idsDesejados.includes(a.cliente_id))
  const paraManter = atuais.filter((a) => idsDesejados.includes(a.cliente_id))
  const paraCriar = idsDesejados.filter((id) => !atuais.some((a) => a.cliente_id === id))

  const totalFinal = paraManter.length + paraCriar.length
  const novoGrupoId = totalFinal > 1 ? (input.grupoId ?? randomUUID()) : null

  // Ver eventoJaTerminou — repõe "Agendado" se o evento já estava
  // "Concluído" e a nova data/hora ainda não chegou ao fim.
  const reabrir =
    atuais.some((a) => a.estado === 'Concluído') &&
    !eventoJaTerminou(input.data, input.horaInicio, input.duracaoMin)

  const camposPartilhados = {
    tipo: input.tipo,
    pt_id: input.ptId,
    titulo: input.titulo,
    lead_id: input.leadId,
    telefone: input.telefone,
    data: input.data,
    hora_inicio: input.horaInicio,
    duracao_min: input.duracaoMin,
    grupo_id: novoGrupoId,
    nota: input.nota,
    ...(reabrir ? { estado: 'Agendado' as const } : {}),
  }

  if (paraApagar.length > 0) {
    const erroLimpar = await limparVisitaLeadsApagadas(supabase, paraApagar)
    if (erroLimpar) return { error: erroLimpar }

    const { error } = await supabase
      .from('agenda_eventos')
      .delete()
      .in('id', paraApagar.map((a) => a.id))
    if (error) return { error: error.message }
  }

  if (paraManter.length > 0) {
    const { error } = await supabase
      .from('agenda_eventos')
      .update(camposPartilhados)
      .in('id', paraManter.map((a) => a.id))
    if (error) return { error: error.message }

    // O dia/hora deste treino pode ter mudado — numa Sessão
    // experimental isso tem de se refletir logo na lead associada,
    // senão ela fica a apontar para um horário que já não é o do
    // evento (ver sincronizarVisitaLead).
    if (input.tipo === 'Sessão experimental') {
      const erroLead = await sincronizarVisitaLead(supabase, input.leadId, input.data, input.horaInicio)
      if (erroLead) return { error: erroLead }
    }
  }

  if (paraCriar.length > 0) {
    const sessao = await getSessaoAtual()
    const linhas = paraCriar.map((clienteId) => ({
      estudio_id: input.estudioId,
      cliente_id: clienteId,
      criado_por: sessao.userId,
      ...camposPartilhados,
    }))
    const { error } = await supabase.from('agenda_eventos').insert(linhas)
    if (error) return { error: error.message }
  }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function moverEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
  data: string
  horaInicio: string
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const selectQuery = supabase.from('agenda_eventos').select('estado, duracao_min')
  const { data: atuais, error: erroAtuais } = input.grupoId
    ? await selectQuery.eq('grupo_id', input.grupoId)
    : await selectQuery.eq('id', input.id)
  if (erroAtuais) return { error: erroAtuais.message }

  // Ver eventoJaTerminou — repõe "Agendado" se o evento já estava
  // "Concluído" e o novo dia/hora ainda não chegou ao fim.
  const reabrir =
    (atuais ?? []).some((e) => e.estado === 'Concluído') &&
    !eventoJaTerminou(input.data, input.horaInicio, (atuais ?? [])[0]?.duracao_min ?? 0)

  // Mover para outro dia/hora invalida um lembrete já enviado (ficou a
  // falar do dia errado) — repõe-se para o cron voltar a avisar na
  // véspera do novo dia. Ver o mesmo cuidado em atualizarEvento.
  const query = supabase.from('agenda_eventos').update({
    data: input.data,
    hora_inicio: input.horaInicio,
    lembrete_enviado: false,
    lembrete_enviado_em: null,
    ...(reabrir ? { estado: 'Agendado' as const } : {}),
  })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  const erroLead = await sincronizarVisitasLeadsAposMover(supabase, { grupoId: input.grupoId, id: input.id })
  if (erroLead) return { error: erroLead }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function redimensionarEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
  horaInicio: string
  duracaoMin: number
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const selectQuery = supabase.from('agenda_eventos').select('estado, data')
  const { data: atuais, error: erroAtuais } = input.grupoId
    ? await selectQuery.eq('grupo_id', input.grupoId)
    : await selectQuery.eq('id', input.id)
  if (erroAtuais) return { error: erroAtuais.message }

  // Ver eventoJaTerminou — repõe "Agendado" se o evento já estava
  // "Concluído" e o novo fim (mesma data, hora/duração novas) ainda não
  // chegou.
  const reabrir =
    (atuais ?? []).some((e) => e.estado === 'Concluído') &&
    !eventoJaTerminou((atuais ?? [])[0]?.data ?? '', input.horaInicio, input.duracaoMin)

  // Mesmo cuidado que em moverEventoRapido: mudar a hora de início
  // invalida um lembrete já enviado (ficou a dizer uma hora errada).
  const query = supabase.from('agenda_eventos').update({
    hora_inicio: input.horaInicio,
    duracao_min: input.duracaoMin,
    lembrete_enviado: false,
    lembrete_enviado_em: null,
    ...(reabrir ? { estado: 'Agendado' as const } : {}),
  })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  const erroLead = await sincronizarVisitasLeadsAposMover(supabase, { grupoId: input.grupoId, id: input.id })
  if (erroLead) return { error: erroLead }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function desmarcarEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
  motivo: string | null
  contarComoRealizado: boolean
  foiRemarcado: boolean
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  // Linhas afetadas (uma ou o grupo todo) antes de mudar o estado, para
  // saber quem reconciliar depois na ficha de presenças.
  const { data: linhasData, error: erroLinhas } = input.grupoId
    ? await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('grupo_id', input.grupoId)
    : await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('id', input.id)
  if (erroLinhas) return { error: erroLinhas.message }

  const query = supabase
    .from('agenda_eventos')
    .update({ estado: 'Cancelado', motivo_cancelamento: input.motivo, foi_remarcado: input.foiRemarcado })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  const erroReconciliar = await reconciliarPresencasDoEvento(supabase, linhasData ?? [], input.contarComoRealizado)
  if (erroReconciliar) return { error: erroReconciliar }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function reativarEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const { data: linhasData, error: erroLinhas } = input.grupoId
    ? await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('grupo_id', input.grupoId)
    : await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('id', input.id)
  if (erroLinhas) return { error: erroLinhas.message }

  const query = supabase
    .from('agenda_eventos')
    .update({ estado: 'Agendado', motivo_cancelamento: null, foi_remarcado: false })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  // Volta a "Agendado" — desfaz a presença que a agenda tivesse criado
  // (só essa); o cron volta a contá-la quando o evento terminar.
  const erroReconciliar = await reconciliarPresencasDoEvento(supabase, linhasData ?? [], false)
  if (erroReconciliar) return { error: erroReconciliar }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function pararSerieRapido(input: {
  estudioSlug: string
  serieId: string
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const { error: erroSerie } = await supabase.from('agenda_series').update({ ativa: false }).eq('id', input.serieId)
  if (erroSerie) return { error: erroSerie.message }

  const hoje = new Date().toISOString().slice(0, 10)
  const { error: erroCancelar } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Cancelado', motivo_cancelamento: 'Série interrompida' })
    .eq('serie_id', input.serieId)
    .eq('estado', 'Agendado')
    .gte('data', hoje)
  if (erroCancelar) return { error: erroCancelar.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function apagarEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
  serieId: string | null
  data: string
  escopo: EscopoApagar
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  let selecao = supabase.from('agenda_eventos').select('id, lead_id, data, hora_inicio')
  if (input.escopo !== 'um' && input.serieId) {
    selecao = selecao.eq('serie_id', input.serieId)
    if (input.escopo === 'seguintes') selecao = selecao.gte('data', input.data)
    else if (input.escopo === 'anteriores') selecao = selecao.lte('data', input.data)
  } else {
    selecao = input.grupoId ? selecao.eq('grupo_id', input.grupoId) : selecao.eq('id', input.id)
  }
  const { data: eventosParaApagar, error: erroLer } = await selecao
  if (erroLer) return { error: erroLer.message }

  const erroLimpar = await limparVisitaLeadsApagadas(supabase, eventosParaApagar ?? [])
  if (erroLimpar) return { error: erroLimpar }

  const { error } = await supabase
    .from('agenda_eventos')
    .delete()
    .in('id', (eventosParaApagar ?? []).map((e) => e.id))
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}
