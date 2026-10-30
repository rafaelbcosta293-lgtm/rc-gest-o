'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { gerarOcorrencias, type Repeticao } from '@/lib/data/agenda'
import type { TipoEventoAgenda } from '@/lib/supabase/database.types'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
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
  const supabase = await createClient()

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Cancelado', motivo_cancelamento: motivo })
    .eq('id', id)

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
    .update({ estado: 'Agendado', motivo_cancelamento: null })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/agenda/${id}?error=${encodeURIComponent(error.message)}`)
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
  clienteId: string | null
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

  const { error } = await supabase.from('agenda_eventos').insert({
    estudio_id: input.estudioId,
    cliente_id: input.clienteId,
    pt_id: input.ptId,
    tipo: input.tipo,
    titulo: input.titulo,
    data: input.data,
    hora_inicio: input.horaInicio,
    duracao_min: input.duracaoMin,
    nota: input.nota,
    criado_por: sessao.userId,
  })
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function atualizarEventoRapido(
  input: CamposEvento & { id: string }
): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  // Tal como atualizarEvento: só esta linha, nunca a série toda.
  const { error } = await supabase
    .from('agenda_eventos')
    .update({
      tipo: input.tipo,
      cliente_id: input.clienteId,
      pt_id: input.ptId,
      titulo: input.titulo,
      data: input.data,
      hora_inicio: input.horaInicio,
      duracao_min: input.duracaoMin,
      nota: input.nota,
    })
    .eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function moverEventoRapido(input: {
  estudioSlug: string
  id: string
  data: string
  horaInicio: string
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ data: input.data, hora_inicio: input.horaInicio })
    .eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function redimensionarEventoRapido(input: {
  estudioSlug: string
  id: string
  horaInicio: string
  duracaoMin: number
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ hora_inicio: input.horaInicio, duracao_min: input.duracaoMin })
    .eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function desmarcarEventoRapido(input: {
  estudioSlug: string
  id: string
  motivo: string | null
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Cancelado', motivo_cancelamento: input.motivo })
    .eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function reativarEventoRapido(input: {
  estudioSlug: string
  id: string
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('agenda_eventos')
    .update({ estado: 'Agendado', motivo_cancelamento: null })
    .eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}

export async function apagarEventoRapido(input: {
  estudioSlug: string
  id: string
}): Promise<ResultadoAcaoRapida> {
  const supabase = await createClient()

  const { error } = await supabase.from('agenda_eventos').delete().eq('id', input.id)
  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/agenda`)
  return { ok: true }
}
