'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { getSessaoAtual } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import {
  correspondePalavras,
  gerarOcorrencias,
  eventoJaTerminou,
  ocorrenciasAMover,
  palavrasDaPesquisa,
  pesquisarEventosAgenda,
  type EventoPesquisavel,
  type OcorrenciaDaSerie,
  type LimiteRepeticao,
  type Repeticao, limparMotivoDesmarcacao } from '@/lib/data/agenda'
import type { EstadoEventoAgenda, TipoEventoAgenda } from '@/lib/supabase/database.types'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { registarContactoExperimental } from '@/lib/data/contactoExperimental'
import { datasFechadas, mensagemDiaFechado } from '@/lib/data/diasFechados'
import { papeisDaSessao } from '@/lib/data/sessao'

import { tipoDeVisita } from '@/lib/data/relatorioComercial'
import { exigeInstrutor, instrutorHerdado, MENSAGEM_FALTA_INSTRUTOR } from '@/lib/data/controloInstrutores'
function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export type ResultadoPesquisaAgenda = {
  id: string
  data: string
  horaInicio: string
  duracaoMin: number
  tipo: TipoEventoAgenda
  titulo: string | null
  estado: EventoPesquisavel['estado']
  nomeCliente: string | null
  nomePt: string | null
}

export type ClientePesquisaAgenda = { id: string; nome: string; numeroSocio: string | null; estado: string }

// Pesquisa global na agenda (não só no período visível) — pede-se um
// mínimo de 2 caracteres para não trazer o estúdio inteiro a cada
// toque de tecla. Devolve primeiro os clientes cujo nome tem todas as
// palavras escritas, em qualquer ordem ("Maria Garcia" encontra "Maria
// João Garcia"), e depois os eventos que correspondem. Vai buscar tudo
// do estúdio (sem janela de datas: a agenda de um estúdio ainda é
// pequena) e filtra em memória, para encontrar por nome mesmo com
// acentos diferentes dos escritos.
export async function pesquisarAgenda(
  estudioId: number,
  texto: string
): Promise<{ clientes: ClientePesquisaAgenda[]; eventos: ResultadoPesquisaAgenda[] }> {
  if (texto.trim().length < 2) return { clientes: [], eventos: [] }
  const supabase = await createClient()
  const [{ data, error }, { data: clientesData, error: erroClientes }] = await Promise.all([
    todasAsLinhas((de, ate) =>
      supabase
        .from('agenda_eventos')
        .select(
          'id, data, hora_inicio, duracao_min, tipo, titulo, estado, nota, cliente:clientes(nome, nome_preferido, numero_socio), pt:perfis!pt_id(nome)'
        )
        .eq('estudio_id', estudioId)
        .order('data', { ascending: false })
        .order('hora_inicio', { ascending: false })
        .order('id')
        .range(de, ate)
    ),
    todasAsLinhas((de, ate) =>
      supabase.from('clientes').select('id, nome, nome_preferido, numero_socio, estado').eq('estudio_id', estudioId).order('id').range(de, ate)
    ),
  ])
  if (error) throw new Error(error.message)
  if (erroClientes) throw new Error(erroClientes.message)

  const palavras = palavrasDaPesquisa(texto)
  type ClienteLinha = { id: string; nome: string; nome_preferido: string | null; numero_socio: string | null; estado: string }
  const clientes = ((clientesData ?? []) as ClienteLinha[])
    .filter((c) => correspondePalavras(palavras, [c.nome, c.nome_preferido, c.numero_socio]))
    // Os ativos primeiro; depois por nome.
    .sort((a, b) => Number(a.estado !== 'Ativo') - Number(b.estado !== 'Ativo') || a.nome.localeCompare(b.nome, 'pt'))
    .slice(0, 8)
    .map((c) => ({ id: c.id, nome: c.nome, numeroSocio: c.numero_socio, estado: c.estado }))

  const eventos = (data ?? []) as unknown as EventoPesquisavel[]
  const encontrados = pesquisarEventosAgenda(eventos, texto).slice(0, 50)
  return {
    clientes,
    eventos: encontrados.map((e) => ({
      id: e.id,
      data: e.data,
      horaInicio: e.hora_inicio,
      duracaoMin: e.duracao_min,
      tipo: e.tipo,
      titulo: e.titulo,
      estado: e.estado,
      nomeCliente: e.cliente?.nome_preferido ?? e.cliente?.nome ?? null,
      nomePt: e.pt?.nome ?? null,
    })),
  }
}

export type HistoricoAgendaCliente = {
  cliente: { id: string; nome: string; numeroSocio: string | null; estado: string; estudioSlug: string | null }
  eventos: (ResultadoPesquisaAgenda & { nota: string | null; motivoCancelamento: string | null; estudioSlug: string | null })[]
}

// Tudo o que um cliente tem (e teve) na agenda — treinos, avaliações,
// sessões, do primeiro ao último, por ordem — para a janela que abre a
// partir da pesquisa.
export async function historicoAgendaCliente(clienteId: string): Promise<HistoricoAgendaCliente | { erro: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return { erro: 'Cliente não encontrado.' }
  const supabase = await createClient()
  const [{ data: cliente, error: erroCliente }, { data, error }] = await Promise.all([
    supabase.from('clientes').select('id, nome, nome_preferido, numero_socio, estado, estudio:estudios(slug)').eq('id', clienteId).maybeSingle(),
    todasAsLinhas((de, ate) =>
      supabase
        .from('agenda_eventos')
        .select('id, data, hora_inicio, duracao_min, tipo, titulo, estado, nota, motivo_cancelamento, pt:perfis!pt_id(nome), estudio:estudios(slug)')
        .eq('cliente_id', clienteId)
        .order('data')
        .order('hora_inicio')
        .order('id')
        .range(de, ate)
    ),
  ])
  if (erroCliente || error) return { erro: (erroCliente ?? error)!.message }
  if (!cliente) return { erro: 'Cliente não encontrado.' }
  type Linha = {
    id: string
    data: string
    hora_inicio: string
    duracao_min: number
    tipo: TipoEventoAgenda
    titulo: string | null
    estado: EstadoEventoAgenda
    nota: string | null
    motivo_cancelamento: string | null
    pt: { nome: string } | null
    estudio: { slug: string } | null
  }
  const c = cliente as unknown as { id: string; nome: string; nome_preferido: string | null; numero_socio: string | null; estado: string; estudio: { slug: string } | null }
  return {
    cliente: { id: c.id, nome: c.nome_preferido ? `${c.nome} (${c.nome_preferido})` : c.nome, numeroSocio: c.numero_socio, estado: c.estado, estudioSlug: c.estudio?.slug ?? null },
    eventos: ((data ?? []) as unknown as Linha[]).map((e) => ({
      id: e.id,
      data: e.data,
      horaInicio: e.hora_inicio,
      duracaoMin: e.duracao_min,
      tipo: e.tipo,
      titulo: e.titulo,
      estado: e.estado,
      nomeCliente: c.nome,
      nomePt: e.pt?.nome ?? null,
      nota: e.nota,
      motivoCancelamento: e.motivo_cancelamento,
      estudioSlug: e.estudio?.slug ?? null,
    })),
  }
}

// Uma conta pessoal (fora das 4 contas fixas do negócio) só pode VER a
// Agenda, a não ser que a Administração lhe tenha dado permissão para
// a editar (Administração → Contas) — todas as ações que
// escrevem chamam isto primeiro, nunca confiando só em a UI escondido
// os botões (um pedido direto à ação continuaria a escrever sem isto).
const MENSAGEM_AGENDA_SO_LEITURA = 'A tua conta só pode ver a Agenda — pede a um responsável para fazer esta alteração.'

async function bloquearEscritaNaAgenda(): Promise<string | null> {
  const sessao = await getSessaoAtual()
  return ehContaFixa(sessao.email) || sessao.agendaEscrita ? null : MENSAGEM_AGENDA_SO_LEITURA
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
  const hoje = hojeEmLisboa()
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

// Sessão experimental desmarcada na Agenda → a lead passa no funil para
// "Falhou a experimental" (não realizou a sessão) e deixa de mostrar a
// visita marcada. Só mexe em leads que estavam em "Experimental
// agendada" — nunca numa já ganha, perdida ou noutra etapa à frente.
async function experimentalDesmarcada(supabase: SupabaseClient, eventoIds: string[]): Promise<string | null> {
  if (eventoIds.length === 0) return null
  const { data: eventos, error } = await supabase
    .from('agenda_eventos')
    .select('lead_id, data, hora_inicio, tipo')
    .in('id', eventoIds)
    .eq('tipo', 'Sessão experimental')
    .not('lead_id', 'is', null)
  if (error) return error.message
  const leadIds = [...new Set((eventos ?? []).map((e) => e.lead_id as string))]
  if (leadIds.length === 0) return null
  const { error: erroLead } = await supabase
    .from('leads')
    .update({ estado: 'Falhou a experimental' })
    .in('id', leadIds)
    .eq('estado', 'Experimental agendada')
  if (erroLead) return erroLead.message
  return limparVisitaLeadsApagadas(supabase, (eventos ?? []) as EventoParaLimparVisita[])
}

// Sessão experimental reativada → a lead volta a "Experimental agendada"
// (se tinha passado a "Falhou a experimental"), com a visita outra vez.
async function experimentalReativada(supabase: SupabaseClient, eventoIds: string[]): Promise<string | null> {
  if (eventoIds.length === 0) return null
  const { data: eventos, error } = await supabase
    .from('agenda_eventos')
    .select('lead_id, data, hora_inicio')
    .in('id', eventoIds)
    .eq('tipo', 'Sessão experimental')
    .not('lead_id', 'is', null)
  if (error) return error.message
  for (const e of eventos ?? []) {
    const { data: lead } = await supabase.from('leads').select('estado').eq('id', e.lead_id).maybeSingle()
    if (lead?.estado !== 'Falhou a experimental') continue
    const erro = await sincronizarVisitaLead(supabase, e.lead_id as string, e.data as string, e.hora_inicio as string)
    if (erro) return erro
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

// Ao editar "este e os seguintes" ou "toda a série", o modelo da série
// (de onde o cron gera as ocorrências futuras) fica igual ao que se
// acabou de guardar — senão as próximas a nascer voltavam à hora ou à
// nota antigas. O instrutor de um treino fica de fora (instrutorHerdado).
async function atualizarModeloDaSerie(
  supabase: SupabaseClient,
  serieId: string,
  campos: {
    tipo: TipoEventoAgenda
    cliente_id: string | null
    pt_id: string | null
    titulo: string | null
    hora_inicio: string
    duracao_min: number
    nota: string | null
  }
): Promise<string | null> {
  const { error } = await supabase.from('agenda_series').update(campos).eq('id', serieId)
  return error?.message ?? null
}

export async function criarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const tipo = formData.get('tipo') as TipoEventoAgenda
  const clienteId = campoOuNull(formData, 'cliente_id')
  const ptId = campoOuNull(formData, 'pt_id')
  const titulo = campoOuNull(formData, 'titulo')
  const leadId = campoOuNull(formData, 'lead_id')
  // Treino experimental ou visita de condições (só nas sessões experimentais).
  const visitaTipo = tipo === 'Sessão experimental' ? tipoDeVisita(campoOuNull(formData, 'visita_tipo')) : null
  const telefone = campoOuNull(formData, 'telefone')
  const data = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const duracaoMin = Number(formData.get('duracao_min')) || 40
  const nota = campoOuNull(formData, 'nota')
  const repeticao = (formData.get('repeticao') as Repeticao) || 'nao'
  const limiteModo = (formData.get('limite_modo') as string) || 'vezes'
  const repeteAte = campoOuNull(formData, 'repete_ate')
  const repeteVezes = campoOuNull(formData, 'repete_vezes')

  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) {
    redirect(`/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent(bloqueio)}`)
  }

  if (!data || !horaInicio) {
    redirect(
      `/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent('Data e hora são obrigatórias.')}`
    )
  }
  if (exigeInstrutor(tipo) && !ptId) {
    redirect(`/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent(MENSAGEM_FALTA_INSTRUTOR)}`)
  }

  const sessao = await getSessaoAtual()
  const supabase = await createClient()

  const limite: LimiteRepeticao =
    limiteModo === 'indefinido'
      ? { modo: 'indefinido' }
      : limiteModo === 'ate' && repeteAte
        ? { modo: 'ate', ate: repeteAte }
        : { modo: 'vezes', vezes: repeteVezes ? Number(repeteVezes) : 8 }

  // Dias fechados: o primeiro dia não pode estar fechado; numa
  // repetição, as vezes que calham num dia fechado ficam de fora.
  const todasOcorrencias = gerarOcorrencias(data, repeticao, limite)
  const fechadas = await datasFechadas(supabase, estudioId, todasOcorrencias)
  if (fechadas.includes(data)) {
    redirect(`/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent(mensagemDiaFechado([data]))}`)
  }
  const ocorrencias = todasOcorrencias.filter((d) => !fechadas.includes(d))

  // Uma repetição precisa de um modelo em agenda_series (a base de dados
  // exige-o para o serie_id): a indefinida fica ativa, para o cron a
  // continuar depois desta janela inicial; a de duração definida (até
  // data/N vezes) fica inativa — já está toda gerada.
  let serieId: string | null = null
  if (repeticao !== 'nao' && ocorrencias.length > 1) {
    const { data: serie, error: erroSerie } = await supabase
      .from('agenda_series')
      .insert({
        estudio_id: estudioId,
        cliente_id: clienteId,
        pt_id: instrutorHerdado(tipo, ptId),
        tipo,
        titulo,
        hora_inicio: horaInicio,
        duracao_min: duracaoMin,
        repeticao: repeticao === 'quinzenal' ? 'quinzenal' : 'semanal',
        nota,
        ativa: limite.modo === 'indefinido',
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
  }

  // Num treino que se repete, o instrutor escolhido fica só no primeiro
  // dia; os seguintes atribuem-se um a um (ver instrutorHerdado).
  const linhas = ocorrencias.map((dataOcorrencia) => ({
    estudio_id: estudioId,
    cliente_id: clienteId,
    pt_id: dataOcorrencia === data ? ptId : instrutorHerdado(tipo, ptId),
    tipo,
    titulo,
    lead_id: leadId,
    visita_tipo: visitaTipo,
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
    // Sessão marcada a uma lead da lista = contacto com sucesso.
    const erroContacto = await registarContactoExperimental(supabase, leadId, sessao.userId)
    if (erroContacto) console.error('[agenda] contacto da experimental não registado:', erroContacto)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda?vista=dia&data=${data}`)
}

// Âmbito ao editar um evento de uma série repetida — "um" é só esta
// ocorrência (o de sempre, com data própria); "seguintes" e "serie"
// aplicam os campos partilhados (tipo, cliente, instrutor, hora,
// duração, nota, …) a várias ocorrências de uma vez, mas nunca mexem
// no campo "data" de cada uma — cada ocorrência mantém o seu próprio
// dia, só a hora/duração/resto é que fica igual em todas.
export type EscopoEditar = 'um' | 'seguintes' | 'serie'

export async function atualizarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const tipo = formData.get('tipo') as TipoEventoAgenda
  const clienteId = campoOuNull(formData, 'cliente_id')
  const ptId = campoOuNull(formData, 'pt_id')
  const titulo = campoOuNull(formData, 'titulo')
  const leadId = campoOuNull(formData, 'lead_id')
  // Treino experimental ou visita de condições (só nas sessões experimentais).
  const visitaTipo = tipo === 'Sessão experimental' ? tipoDeVisita(campoOuNull(formData, 'visita_tipo')) : null
  const telefone = campoOuNull(formData, 'telefone')
  const data = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const duracaoMin = Number(formData.get('duracao_min')) || 40
  const nota = campoOuNull(formData, 'nota')
  const escopo = ((formData.get('escopo') as string) || 'um') as EscopoEditar
  const supabase = await createClient()

  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(bloqueio)}`)
  }
  if (exigeInstrutor(tipo) && !ptId) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(MENSAGEM_FALTA_INSTRUTOR)}`)
  }

  // Se o dia ou a hora mudarem depois de o lembrete já ter sido
  // enviado, esse SMS ficou a falar de um treino que já não existe
  // (ou já foi enviado para a data errada) — sem repor isto a app
  // nunca mais avisa, porque o lembrete já conta como "enviado" para
  // sempre, mesmo sendo para outro dia.
  const { data: eventoAtual, error: erroAtual } = await supabase
    .from('agenda_eventos')
    .select('data, hora_inicio, lembrete_enviado, serie_id')
    .eq('id', id)
    .maybeSingle()
  if (erroAtual) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroAtual.message)}`)
  }
  if (eventoAtual && eventoAtual.data !== data) {
    const { data: ev } = await supabase.from('agenda_eventos').select('estudio_id').eq('id', id).maybeSingle()
    const fechadas = ev ? await datasFechadas(supabase, ev.estudio_id, [data]) : []
    if (fechadas.length > 0) redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(mensagemDiaFechado(fechadas))}`)
  }
  const mudouQuandoOuHora =
    !!eventoAtual &&
    (eventoAtual.data !== data || eventoAtual.hora_inicio.slice(0, 5) !== horaInicio.slice(0, 5))
  const repoeLembrete = eventoAtual?.lembrete_enviado === true && mudouQuandoOuHora

  if (escopo === 'um' || !eventoAtual?.serie_id) {
    // Só afeta esta linha (uma ocorrência) — nunca o resto da série.
    const { error } = await supabase
      .from('agenda_eventos')
      .update({
        tipo,
        cliente_id: clienteId,
        pt_id: ptId,
        titulo,
        lead_id: leadId,
        visita_tipo: visitaTipo,
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

    // Mudar o dia/hora de uma Sessão experimental tem de se refletir
    // logo na lead associada — senão ela fica a mostrar uma visita para
    // um dia/hora que já não é o do evento (ver sincronizarVisitaLead).
    if (tipo === 'Sessão experimental') {
      const erroLead = await sincronizarVisitaLead(supabase, leadId, data, horaInicio)
      if (erroLead) {
        redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroLead)}`)
      }
    }
  } else {
    // "Este e os seguintes" / "Toda a série" — aplica os campos
    // partilhados a todas as ocorrências visadas, cada uma guardando a
    // sua própria "data" (nunca se muda o dia de várias ocorrências de
    // uma vez só). Também repõe "Agendado" nas que já estavam
    // "Concluído" mas, com a nova hora/duração, ainda não terminaram.
    let selecao = supabase.from('agenda_eventos').select('id, data, estado').eq('serie_id', eventoAtual.serie_id)
    if (escopo === 'seguintes') selecao = selecao.gte('data', eventoAtual.data)
    const { data: linhas, error: erroLinhas } = await selecao
    if (erroLinhas) {
      redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroLinhas.message)}`)
    }

    const idsTodos = (linhas ?? []).map((l) => l.id)
    const idsReabrir = (linhas ?? [])
      .filter((l) => l.estado === 'Concluído' && !eventoJaTerminou(l.data, horaInicio, duracaoMin))
      .map((l) => l.id)

    const { error } = await supabase
      .from('agenda_eventos')
      .update({
        tipo,
        cliente_id: clienteId,
        // Num treino o instrutor não se copia para a série toda: fica só
        // neste (mais abaixo); os outros mantêm o que cada um tem.
        ...(exigeInstrutor(tipo) ? {} : { pt_id: ptId }),
        titulo,
        lead_id: leadId,
        visita_tipo: visitaTipo,
        telefone,
        hora_inicio: horaInicio,
        duracao_min: duracaoMin,
        nota,
        ...(repoeLembrete ? { lembrete_enviado: false, lembrete_enviado_em: null } : {}),
      })
      .in('id', idsTodos)

    if (error) {
      redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
    }
    if (exigeInstrutor(tipo)) {
      const { error: erroInstrutor } = await supabase.from('agenda_eventos').update({ pt_id: ptId }).eq('id', id)
      if (erroInstrutor) {
        redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroInstrutor.message)}`)
      }
    }

    if (idsReabrir.length > 0) {
      const { error: erroReabrir } = await supabase
        .from('agenda_eventos')
        .update({ estado: 'Agendado' })
        .in('id', idsReabrir)
      if (erroReabrir) {
        redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroReabrir.message)}`)
      }
    }

    const erroModelo = await atualizarModeloDaSerie(supabase, eventoAtual.serie_id, {
      tipo,
      cliente_id: clienteId,
      pt_id: instrutorHerdado(tipo, ptId),
      titulo,
      hora_inicio: horaInicio,
      duracao_min: duracaoMin,
      nota,
    })
    if (erroModelo) {
      redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroModelo)}`)
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

  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(bloqueio)}`)
  }

  const { error: erroSerie } = await supabase.from('agenda_series').update({ ativa: false }).eq('id', serieId)
  if (erroSerie) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroSerie.message)}`)
  }

  const hoje = hojeEmLisboa()
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
  const motivo = limparMotivoDesmarcacao(campoOuNull(formData, 'motivo_cancelamento'))
  const contarComoRealizado = formData.get('conta_como_realizado') === 'sim'
  const foiRemarcado = formData.get('foi_remarcado') === 'sim'
  const supabase = await createClient()

  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(bloqueio)}`)
  }
  if (!motivo) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent('Indica o motivo da desmarcação.')}`)
  }

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
  const erroLead = await experimentalDesmarcada(supabase, [id])
  if (erroLead) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(`Desmarcado, mas a lead não foi atualizada: ${erroLead}`)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  revalidatePath(`/painel/${estudioSlug}/leads`)
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

  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(bloqueio)}`)
  }

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

  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(bloqueio)}`)
  }

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
  const erroLead = await experimentalReativada(supabase, [id])
  if (erroLead) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(erroLead)}`)
  }
  revalidatePath(`/painel/${estudioSlug}/leads`)

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

  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(bloqueio)}`)
  }

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
  // Só para "Sessão experimental": treino experimental ou visita de condições.
  visitaTipo?: string | null
  telefone: string | null
  data: string
  horaInicio: string
  duracaoMin: number
  nota: string | null
}

const visitaTipoDe = (input: { tipo: TipoEventoAgenda; visitaTipo?: string | null }) =>
  input.tipo === 'Sessão experimental' ? tipoDeVisita(input.visitaTipo) : null

export async function criarEventoRapido(
  input: CamposEvento & { estudioId: number; repeticao: Repeticao; limite: LimiteRepeticao }
): Promise<ResultadoAcaoRapida> {
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }
  if (exigeInstrutor(input.tipo) && !input.ptId) return { error: MENSAGEM_FALTA_INSTRUTOR }

  const sessao = await getSessaoAtual()
  const supabase = await createClient()

  const idsClientes: (string | null)[] = input.clienteIds.length > 0 ? input.clienteIds : [null]
  // Dias fechados: o primeiro dia não pode estar fechado; numa
  // repetição, as vezes que calham num dia fechado ficam de fora.
  const todasOcorrencias = gerarOcorrencias(input.data, input.repeticao, input.limite)
  const fechadas = await datasFechadas(supabase, input.estudioId, todasOcorrencias)
  if (fechadas.includes(input.data)) return { error: mensagemDiaFechado([input.data]) }
  const ocorrencias = todasOcorrencias.filter((d) => !fechadas.includes(d))

  // Uma repetição precisa do modelo em agenda_series (a base de dados
  // exige-o para o serie_id): ativo numa série indefinida, para o cron a
  // conseguir continuar; inativo numa de duração definida (já está toda
  // gerada). Guarda só a primeira pessoa quando é um treino em
  // simultâneo (as linhas do grupo partilham a série).
  let serieId: string | null = null
  if (input.repeticao !== 'nao' && ocorrencias.length > 1) {
    const { data: serie, error: erroSerie } = await supabase
      .from('agenda_series')
      .insert({
        estudio_id: input.estudioId,
        cliente_id: idsClientes.length === 1 ? idsClientes[0] : null,
        pt_id: instrutorHerdado(input.tipo, input.ptId),
        tipo: input.tipo,
        titulo: input.titulo,
        hora_inicio: input.horaInicio,
        duracao_min: input.duracaoMin,
        repeticao: input.repeticao === 'quinzenal' ? 'quinzenal' : 'semanal',
        nota: input.nota,
        ativa: input.limite.modo === 'indefinido',
        criado_por: sessao.userId,
      })
      .select('id')
      .single()
    if (erroSerie || !serie) return { error: erroSerie?.message ?? 'Não foi possível criar a série.' }
    serieId = serie.id
  }

  const linhas = ocorrencias.flatMap((dataOcorrencia) => {
    const grupoId = idsClientes.length > 1 ? randomUUID() : null
    return idsClientes.map((clienteId) => ({
      estudio_id: input.estudioId,
      cliente_id: clienteId,
      // Numa repetição, o instrutor fica só no primeiro treino.
      pt_id: dataOcorrencia === input.data ? input.ptId : instrutorHerdado(input.tipo, input.ptId),
      tipo: input.tipo,
      titulo: input.titulo,
      lead_id: input.leadId,
      visita_tipo: visitaTipoDe(input),
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
    // Sessão marcada a uma lead da lista = contacto com sucesso.
    const erroContacto = await registarContactoExperimental(supabase, input.leadId, sessao.userId)
    if (erroContacto) console.error('[agenda] contacto da experimental não registado:', erroContacto)
  }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function atualizarEventoRapido(
  input: CamposEvento & {
    id: string
    grupoId: string | null
    serieId: string | null
    escopo: EscopoEditar
    estudioId: number
  }
): Promise<ResultadoAcaoRapida> {
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }
  if (exigeInstrutor(input.tipo) && !input.ptId) return { error: MENSAGEM_FALTA_INSTRUTOR }

  const supabase = await createClient()

  // "Este e os seguintes" / "Toda a série" — só para o caso comum (sem
  // treino em simultâneo): aplica os campos partilhados a todas as
  // ocorrências visadas, cada uma guardando a sua própria "data". A UI
  // só oferece esta opção quando não há grupo, mas confirma-se aqui
  // também, nunca confiando só nela.
  if (input.escopo !== 'um' && input.serieId && !input.grupoId) {
    let selecao = supabase.from('agenda_eventos').select('id, data, estado').eq('serie_id', input.serieId)
    if (input.escopo === 'seguintes') selecao = selecao.gte('data', input.data)
    const { data: linhas, error: erroLinhas } = await selecao
    if (erroLinhas) return { error: erroLinhas.message }

    const idsTodos = (linhas ?? []).map((l) => l.id)
    const idsReabrir = (linhas ?? [])
      .filter((l) => l.estado === 'Concluído' && !eventoJaTerminou(l.data, input.horaInicio, input.duracaoMin))
      .map((l) => l.id)
    const clienteUnico = input.clienteIds[0] ?? null

    const { error } = await supabase
      .from('agenda_eventos')
      .update({
        tipo: input.tipo,
        cliente_id: clienteUnico,
        // Num treino o instrutor não se copia para a série toda: fica só
        // neste (a seguir); os outros mantêm o que cada um tem.
        ...(exigeInstrutor(input.tipo) ? {} : { pt_id: input.ptId }),
        titulo: input.titulo,
        lead_id: input.leadId,
        visita_tipo: visitaTipoDe(input),
        telefone: input.telefone,
        hora_inicio: input.horaInicio,
        duracao_min: input.duracaoMin,
        grupo_id: null,
        nota: input.nota,
      })
      .in('id', idsTodos)
    if (error) return { error: error.message }
    if (exigeInstrutor(input.tipo)) {
      const { error: erroInstrutor } = await supabase.from('agenda_eventos').update({ pt_id: input.ptId }).eq('id', input.id)
      if (erroInstrutor) return { error: erroInstrutor.message }
    }

    if (idsReabrir.length > 0) {
      const { error: erroReabrir } = await supabase
        .from('agenda_eventos')
        .update({ estado: 'Agendado' })
        .in('id', idsReabrir)
      if (erroReabrir) return { error: erroReabrir.message }
    }

    const erroModelo = await atualizarModeloDaSerie(supabase, input.serieId, {
      tipo: input.tipo,
      cliente_id: clienteUnico,
      pt_id: instrutorHerdado(input.tipo, input.ptId),
      titulo: input.titulo,
      hora_inicio: input.horaInicio,
      duracao_min: input.duracaoMin,
      nota: input.nota,
    })
    if (erroModelo) return { error: erroModelo }

    revalidatePath(`/painel/${input.estudioSlug}/agenda`)
    return { ok: true }
  }

  {
    const { data: atual } = await supabase.from('agenda_eventos').select('data').eq('id', input.id).maybeSingle()
    if (atual && atual.data !== input.data) {
      const fechadas = await datasFechadas(supabase, input.estudioId, [input.data])
      if (fechadas.length > 0) return { error: mensagemDiaFechado(fechadas) }
    }
  }

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
    visita_tipo: visitaTipoDe(input),
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

// Mover ou redimensionar uma série inteira (ou "este e os seguintes")
// a partir de um arrasto na grelha. Cada ocorrência anda os mesmos dias
// que a arrastada (ex.: de terça para segunda, todas um dia antes) e
// fica com a hora/duração nova; as que já aconteceram ou foram
// desmarcadas ficam como estão (são histórico). O modelo da série
// (agenda_series) também fica com a hora/duração nova, para as
// ocorrências que o cron ainda vai gerar nascerem já certas — e como o
// cron continua a partir da última data, nascem também no dia novo.
async function aplicarASerie(
  supabase: SupabaseClient,
  input: {
    id: string
    serieId: string
    escopo: 'seguintes' | 'serie'
    dataNova: string | null
    horaInicio: string
    duracaoMin: number | null
  }
): Promise<string | null> {
  const { data: arrastado, error: erroArrastado } = await supabase.from('agenda_eventos').select('data').eq('id', input.id).maybeSingle()
  if (erroArrastado || !arrastado) return erroArrastado?.message ?? 'Evento não encontrado.'
  const { data: linhas, error } = await supabase
    .from('agenda_eventos')
    .select('id, data, hora_inicio, duracao_min, estado')
    .eq('serie_id', input.serieId)
  if (error) return error.message
  const ocorrencias = (linhas ?? []) as OcorrenciaDaSerie[]
  // A arrastada muda sempre (é a que se viu mudar), mesmo que já tenha passado.
  const visadas = ocorrenciasAMover(ocorrencias, input.escopo, arrastado.data, input.dataNova ?? arrastado.data, (o) =>
    o.id === input.id ? false : eventoJaTerminou(o.data, o.hora_inicio, o.duracao_min)
  )
  if (visadas.length === 0) return null
  if (input.dataNova && input.dataNova !== arrastado.data) {
    const { data: ev } = await supabase.from('agenda_eventos').select('estudio_id').eq('id', input.id).maybeSingle()
    const fechadas = ev ? await datasFechadas(supabase, ev.estudio_id, visadas.map((v) => v.dataNova)) : []
    if (fechadas.length > 0) return mensagemDiaFechado(fechadas)
  }

  // Uma atualização por dia novo (as linhas de um treino em simultâneo
  // partilham o dia) — sempre por id, para nunca apanhar uma linha que
  // já foi mudada.
  const porDia = new Map<string, string[]>()
  for (const v of visadas) porDia.set(v.dataNova, [...(porDia.get(v.dataNova) ?? []), v.id])
  for (const [dia, ids] of porDia) {
    const { error: erroUpdate } = await supabase
      .from('agenda_eventos')
      .update({
        data: dia,
        hora_inicio: input.horaInicio,
        ...(input.duracaoMin != null ? { duracao_min: input.duracaoMin } : {}),
        lembrete_enviado: false,
        lembrete_enviado_em: null,
      })
      .in('id', ids)
    if (erroUpdate) return erroUpdate.message
  }
  // Se a arrastada já estava concluída e a nova data/hora ainda não chegou, volta a "Agendado".
  const arrastadaAntes = ocorrencias.find((o) => o.id === input.id)
  if (arrastadaAntes?.estado === 'Concluído') {
    const fim = eventoJaTerminou(input.dataNova ?? arrastado.data, input.horaInicio, input.duracaoMin ?? arrastadaAntes.duracao_min)
    if (!fim) await supabase.from('agenda_eventos').update({ estado: 'Agendado' }).eq('id', input.id)
  }

  const { error: erroModelo } = await supabase
    .from('agenda_series')
    .update({ hora_inicio: input.horaInicio, ...(input.duracaoMin != null ? { duracao_min: input.duracaoMin } : {}) })
    .eq('id', input.serieId)
  return erroModelo?.message ?? null
}

export async function moverEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
  data: string
  horaInicio: string
  // Num evento que faz parte de uma série: só este (omissão), este e os
  // seguintes, ou toda a série.
  serieId?: string | null
  escopo?: EscopoEditar
}): Promise<ResultadoAcaoRapida> {
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }

  const supabase = await createClient()

  if (input.serieId && input.escopo && input.escopo !== 'um') {
    const erro = await aplicarASerie(supabase, {
      id: input.id,
      serieId: input.serieId,
      escopo: input.escopo,
      dataNova: input.data,
      horaInicio: input.horaInicio,
      duracaoMin: null,
    })
    if (erro) return { error: erro }
    revalidatePath(`/painel/${input.estudioSlug}/agenda`)
    return { ok: true }
  }

  {
    const { data: ev } = await supabase.from('agenda_eventos').select('estudio_id, data').eq('id', input.id).maybeSingle()
    if (ev && ev.data !== input.data) {
      const fechadas = await datasFechadas(supabase, ev.estudio_id, [input.data])
      if (fechadas.length > 0) return { error: mensagemDiaFechado(fechadas) }
    }
  }

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
  serieId?: string | null
  escopo?: EscopoEditar
}): Promise<ResultadoAcaoRapida> {
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }

  const supabase = await createClient()

  if (input.serieId && input.escopo && input.escopo !== 'um') {
    const erro = await aplicarASerie(supabase, {
      id: input.id,
      serieId: input.serieId,
      escopo: input.escopo,
      dataNova: null,
      horaInicio: input.horaInicio,
      duracaoMin: input.duracaoMin,
    })
    if (erro) return { error: erro }
    revalidatePath(`/painel/${input.estudioSlug}/agenda`)
    return { ok: true }
  }

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
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }
  // O motivo é obrigatório: fica com o evento e é o que se lê depois, ao
  // passar o rato por cima do desmarcado.
  const motivo = limparMotivoDesmarcacao(input.motivo)
  if (!motivo) return { error: 'Indica o motivo da desmarcação.' }

  const supabase = await createClient()

  // Linhas afetadas (uma ou o grupo todo) antes de mudar o estado, para
  // saber quem reconciliar depois na ficha de presenças.
  const { data: linhasData, error: erroLinhas } = input.grupoId
    ? await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('grupo_id', input.grupoId)
    : await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('id', input.id)
  if (erroLinhas) return { error: erroLinhas.message }

  const query = supabase
    .from('agenda_eventos')
    .update({ estado: 'Cancelado', motivo_cancelamento: motivo, foi_remarcado: input.foiRemarcado })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  const erroReconciliar = await reconciliarPresencasDoEvento(supabase, linhasData ?? [], input.contarComoRealizado)
  if (erroReconciliar) return { error: erroReconciliar }
  const erroLead = await experimentalDesmarcada(supabase, (linhasData ?? []).map((l) => l.id as string))
  if (erroLead) return { error: `Desmarcado, mas a lead não foi atualizada: ${erroLead}` }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  revalidatePath(`/painel/${input.estudioSlug}/leads`)
  return { ok: true }
}

// Acrescentar ou corrigir o motivo de um evento já desmarcado (ex.: só
// se soube depois, ou foi desmarcado antes de o motivo ser pedido).
export async function guardarMotivoDesmarcacaoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
  motivo: string | null
}): Promise<ResultadoAcaoRapida> {
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }
  const motivo = limparMotivoDesmarcacao(input.motivo)
  if (!motivo) return { error: 'Escreve o motivo da desmarcação.' }

  const supabase = await createClient()
  const query = supabase.from('agenda_eventos').update({ motivo_cancelamento: motivo }).eq('estado', 'Cancelado')
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function reativarEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
}): Promise<ResultadoAcaoRapida> {
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }

  const supabase = await createClient()

  const { data: linhasData, error: erroLinhas } = input.grupoId
    ? await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('grupo_id', input.grupoId)
    : await supabase.from('agenda_eventos').select('id, cliente_id, data, pt_id').eq('id', input.id)
  if (erroLinhas) return { error: erroLinhas.message }
  {
    const { data: ev } = await supabase.from('agenda_eventos').select('estudio_id, data').eq('id', input.id).maybeSingle()
    const fechadas = ev ? await datasFechadas(supabase, ev.estudio_id, [ev.data]) : []
    if (fechadas.length > 0) return { error: mensagemDiaFechado(fechadas) }
  }

  const query = supabase
    .from('agenda_eventos')
    .update({ estado: 'Agendado', motivo_cancelamento: null, foi_remarcado: false })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  // Volta a "Agendado" — desfaz a presença que a agenda tivesse criado
  // (só essa); o cron volta a contá-la quando o evento terminar.
  const erroReconciliar = await reconciliarPresencasDoEvento(supabase, linhasData ?? [], false)
  if (erroReconciliar) return { error: erroReconciliar }
  const erroLead = await experimentalReativada(supabase, (linhasData ?? []).map((l) => l.id as string))
  if (erroLead) return { error: erroLead }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  revalidatePath(`/painel/${input.estudioSlug}/leads`)
  return { ok: true }
}

export async function pararSerieRapido(input: {
  estudioSlug: string
  serieId: string
}): Promise<ResultadoAcaoRapida> {
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }

  const supabase = await createClient()

  const { error: erroSerie } = await supabase.from('agenda_series').update({ ativa: false }).eq('id', input.serieId)
  if (erroSerie) return { error: erroSerie.message }

  const hoje = hojeEmLisboa()
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
  const bloqueio = await bloquearEscritaNaAgenda()
  if (bloqueio) return { error: bloqueio }

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

// ── Dias fechados (feriados) ─────────────────────────────────────────

// Fechar o estúdio num dia (só a gestão): a partir daí a Agenda não
// deixa marcar, mover nem repetir treinos para esse dia. Os treinos que
// já lá estavam marcados ficam como estão — a página avisa quantos são.
export async function fecharDiaNaAgenda(input: { estudioSlug: string; estudioId: number; data: string; motivo: string | null }): Promise<ResultadoAcaoRapida> {
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehGestao) return { error: 'Só a gestão pode fechar dias na Agenda.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) return { error: 'Data inválida.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('dias_fechados')
    .upsert({ estudio_id: input.estudioId, data: input.data, motivo: input.motivo?.trim() || null }, { onConflict: 'estudio_id,data' })
  if (error) return { error: error.message }
  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function reabrirDiaNaAgenda(input: { estudioSlug: string; estudioId: number; data: string }): Promise<ResultadoAcaoRapida> {
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehGestao) return { error: 'Só a gestão pode reabrir dias na Agenda.' }
  const supabase = await createClient()
  const { error } = await supabase.from('dias_fechados').delete().eq('estudio_id', input.estudioId).eq('data', input.data)
  if (error) return { error: error.message }
  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}
