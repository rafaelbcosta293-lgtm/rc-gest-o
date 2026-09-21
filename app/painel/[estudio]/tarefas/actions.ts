'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { proximaOcorrencia } from '@/lib/data/tarefas'
import type { RecorrenciaTarefa } from '@/lib/supabase/database.types'

export async function criarTarefa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const titulo = (formData.get('titulo') as string)?.trim()
  const recorrencia = (formData.get('recorrencia') as RecorrenciaTarefa) || 'Diária'
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const sessao = await getSessaoAtual()

  if (!titulo) {
    redirect(`/painel/${estudioSlug}/tarefas`)
  }

  const { error } = await supabase.from('tarefas_diarias').insert({
    estudio_id: estudioId,
    titulo,
    recorrencia,
    proxima_data: hoje,
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

// Regista quem fez a tarefa hoje e avança "proxima_data" consoante a
// recorrência — é isso que faz a tarefa desaparecer da lista de hoje e
// só voltar a aparecer no dia certo (diário/semanal/mensal/anual).
export async function marcarFeita(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const tarefaId = formData.get('tarefa_id') as string
  const recorrencia = formData.get('recorrencia') as RecorrenciaTarefa
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const sessao = await getSessaoAtual()

  const { error: erroConcluida } = await supabase
    .from('tarefas_diarias_concluidas')
    .insert({ tarefa_id: tarefaId, data: hoje, feito_por: sessao.userId })

  if (erroConcluida) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(erroConcluida.message)}`)
  }

  const { error: erroTarefa } = await supabase
    .from('tarefas_diarias')
    .update({ proxima_data: proximaOcorrencia(hoje, recorrencia) })
    .eq('id', tarefaId)

  if (erroTarefa) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(erroTarefa.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/tarefas`)
  redirect(`/painel/${estudioSlug}/tarefas`)
}

// Desfazer repõe a tarefa como "por fazer hoje" — não tenta reconstruir
// a data exata de antes, só volta a pôr hoje como próxima ocorrência.
export async function desfazerFeita(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const tarefaId = formData.get('tarefa_id') as string
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  const { error: erroApagar } = await supabase.from('tarefas_diarias_concluidas').delete().eq('id', id)

  if (erroApagar) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(erroApagar.message)}`)
  }

  const { error: erroTarefa } = await supabase
    .from('tarefas_diarias')
    .update({ proxima_data: hoje })
    .eq('id', tarefaId)

  if (erroTarefa) {
    redirect(`/painel/${estudioSlug}/tarefas?error=${encodeURIComponent(erroTarefa.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/tarefas`)
  redirect(`/painel/${estudioSlug}/tarefas`)
}
