'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function camposComuns(formData: FormData) {
  return {
    nome: formData.get('nome') as string,
    telefone: campoOuNull(formData, 'telefone'),
    email: campoOuNull(formData, 'email'),
    objetivo: campoOuNull(formData, 'objetivo'),
    frequencia_semanal: formData.get('frequencia_semanal')
      ? Number(formData.get('frequencia_semanal'))
      : null,
    pt_principal_id: campoOuNull(formData, 'pt_principal_id'),
    alerta: (formData.get('alerta') as string) || 'Nenhum',
    alerta_detalhe: campoOuNull(formData, 'alerta_detalhe'),
    evento: campoOuNull(formData, 'evento'),
    evento_data: campoOuNull(formData, 'evento_data'),
    nascimento: campoOuNull(formData, 'nascimento'),
    notas: campoOuNull(formData, 'notas'),
  }
}

export async function criarCliente(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...camposComuns(formData), estudio_id: estudioId })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/painel/${estudioSlug}/treinos/novo?error=${encodeURIComponent('Não foi possível criar o cliente.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos`)
  redirect(`/painel/${estudioSlug}/treinos/${data.id}`)
}

export async function atualizarCliente(formData: FormData) {
  const id = formData.get('id') as string
  const estudioSlug = formData.get('estudio_slug') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('clientes')
    .update({
      ...camposComuns(formData),
      estado: (formData.get('estado') as string) || 'Ativo',
    })
    .eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/treinos/${id}/editar?error=${encodeURIComponent('Não foi possível guardar as alterações.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos`)
  revalidatePath(`/painel/${estudioSlug}/treinos/${id}`)
  redirect(`/painel/${estudioSlug}/treinos/${id}`)
}
