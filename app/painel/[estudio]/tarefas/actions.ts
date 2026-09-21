'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'

export async function criarTarefa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const titulo = (formData.get('titulo') as string)?.trim()
  const supabase = await createClient()
  const sessao = await getSessaoAtual()

  if (!titulo) {
    redirect(`/painel/${estudioSlug}/tarefas`)
  }

  const { error } = await supabase.from('tarefas_diarias').insert({
    estudio_id: estudioId,
    titulo,
    criado_por: sessao.userId,
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/tarefas`)
  redirect(`/painel/${estudioSlug}/tarefas`)
}

// "Remover" desativa em vez de apagar — mantém o histórico de quem já
// fez a tarefa em dias anteriores.
export async function removerTarefa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('tarefas_diarias').update({ ativa: false }).eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/tarefas`)
  redirect(`/painel/${estudioSlug}/tarefas`)
}

export async function marcarFeita(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const tarefaId = formData.get('tarefa_id') as string
  const data = formData.get('data') as string
  const supabase = await createClient()
  const sessao = await getSessaoAtual()

  const { error } = await supabase
    .from('tarefas_diarias_concluidas')
    .insert({ tarefa_id: tarefaId, data, feito_por: sessao.userId })

  if (error) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/tarefas`)
  redirect(`/painel/${estudioSlug}/tarefas`)
}

export async function desfazerFeita(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('tarefas_diarias_concluidas').delete().eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/tarefas`)
  redirect(`/painel/${estudioSlug}/tarefas`)
}
