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
