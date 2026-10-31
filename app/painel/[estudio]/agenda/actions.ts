'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { gerarOcorrencias, type Repeticao } from '@/lib/data/agenda'
import type { TipoEventoAgenda } from '@/lib/supabase/database.types'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

type LinhaParaReconciliar = { id: string; cliente_id: string | null; data: string; pt_id: string | null }

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

export async function criarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const tipo = formData.get('tipo') as TipoEventoAgenda
  const clienteId = campoOuNull(formData, 'cliente_id')
  const ptId = campoOuNull(formData, 'pt_id')
  const titulo = campoOuNull(formData, 'titulo')
  const data = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const duracaoMin = Number(formData.get('duracao_min')) || 40
  const nota = campoOuNull(formData, 'nota')
  const repeticao = (formData.get('repeticao') as Repeticao) || 'nao'
  const repeteAte = campoOuNull(formData, 'repete_ate')
  const repeteVezes = campoOuNull(formData, 'repete_vezes')

  if (!data || !horaInicio) {
    redirect(
      `/painel/${estudioSlug}/agenda/novo?error=${encodeURIComponent('Data e hora são obrigatórias.')}`
    )
  }

  const sessao = await getSessaoAtual()
  const supabase = await createClient()

  const ocorrencias = gerarOcorrencias(
    data,
    repeticao,
    repeteAte
      ? { modo: 'ate', ate: repeteAte }
      : { modo: 'vezes', vezes: repeteVezes ? Number(repeteVezes) : 8 }
  )
  const serieId = ocorrencias.length > 1 ? randomUUID() : null

  const linhas = ocorrencias.map((dataOcorrencia) => ({
    estudio_id: estudioId,
    cliente_id: clienteId,
    pt_id: ptId,
    tipo,
    titulo,
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
  const data = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const duracaoMin = Number(formData.get('duracao_min')) || 40
  const nota = campoOuNull(formData, 'nota')
  const supabase = await createClient()

  // Só afeta esta linha (uma ocorrência) — nunca o resto da série,
  // mesmo que serie_id esteja preenchido.
  const { error } = await supabase
    .from('agenda_eventos')
    .update({
      tipo,
      cliente_id: clienteId,
      pt_id: ptId,
      titulo,
      data,
      hora_inicio: horaInicio,
      duracao_min: duracaoMin,
      nota,
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/agenda/${id}`)
}

export async function desmarcarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const motivo = campoOuNull(formData, 'motivo_cancelamento')
  const contarComoRealizado = formData.get('conta_como_realizado') === 'sim'
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
    .update({ estado: 'Cancelado', motivo_cancelamento: motivo })
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

export async function reativarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Agendado', motivo_cancelamento: null })
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

export async function apagarEvento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const data = formData.get('data') as string
  const supabase = await createClient()

  // Só a linha desta ocorrência — nunca a série toda.
  const { error } = await supabase.from('agenda_eventos').delete().eq('id', id)

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
  data: string
  horaInicio: string
  duracaoMin: number
  nota: string | null
}

export async function criarEventoRapido(
  input: CamposEvento & { estudioId: number }
): Promise<ResultadoAcaoRapida> {
  const sessao = await getSessaoAtual()
  const supabase = await createClient()

  const idsClientes: (string | null)[] = input.clienteIds.length > 0 ? input.clienteIds : [null]
  const grupoId = idsClientes.length > 1 ? randomUUID() : null

  const linhas = idsClientes.map((clienteId) => ({
    estudio_id: input.estudioId,
    cliente_id: clienteId,
    pt_id: input.ptId,
    tipo: input.tipo,
    titulo: input.titulo,
    data: input.data,
    hora_inicio: input.horaInicio,
    duracao_min: input.duracaoMin,
    grupo_id: grupoId,
    nota: input.nota,
    criado_por: sessao.userId,
  }))

  const { error } = await supabase.from('agenda_eventos').insert(linhas)
  if (error) return { error: error.message }

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
    ? await supabase.from('agenda_eventos').select('id, cliente_id').eq('grupo_id', input.grupoId)
    : await supabase.from('agenda_eventos').select('id, cliente_id').eq('id', input.id)
  if (erroAtuais) return { error: erroAtuais.message }
  const atuais = atuaisData ?? []

  const idsDesejados: (string | null)[] = input.clienteIds.length > 0 ? input.clienteIds : [null]
  const paraApagar = atuais.filter((a) => !idsDesejados.includes(a.cliente_id))
  const paraManter = atuais.filter((a) => idsDesejados.includes(a.cliente_id))
  const paraCriar = idsDesejados.filter((id) => !atuais.some((a) => a.cliente_id === id))

  const totalFinal = paraManter.length + paraCriar.length
  const novoGrupoId = totalFinal > 1 ? (input.grupoId ?? randomUUID()) : null

  const camposPartilhados = {
    tipo: input.tipo,
    pt_id: input.ptId,
    titulo: input.titulo,
    data: input.data,
    hora_inicio: input.horaInicio,
    duracao_min: input.duracaoMin,
    grupo_id: novoGrupoId,
    nota: input.nota,
  }

  if (paraApagar.length > 0) {
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

  const query = supabase.from('agenda_eventos').update({ data: input.data, hora_inicio: input.horaInicio })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

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

  const query = supabase
    .from('agenda_eventos')
    .update({ hora_inicio: input.horaInicio, duracao_min: input.duracaoMin })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function desmarcarEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
  motivo: string | null
  contarComoRealizado: boolean
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
    .update({ estado: 'Cancelado', motivo_cancelamento: input.motivo })
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

  const query = supabase.from('agenda_eventos').update({ estado: 'Agendado', motivo_cancelamento: null })
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  // Volta a "Agendado" — desfaz a presença que a agenda tivesse criado
  // (só essa); o cron volta a contá-la quando o evento terminar.
  const erroReconciliar = await reconciliarPresencasDoEvento(supabase, linhasData ?? [], false)
  if (erroReconciliar) return { error: erroReconciliar }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function apagarEventoRapido(input: {
  estudioSlug: string
  id: string
  grupoId: string | null
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const query = supabase.from('agenda_eventos').delete()
  const { error } = input.grupoId ? await query.eq('grupo_id', input.grupoId) : await query.eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}
