'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AlertaTipo } from '@/lib/data/constantes'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function camposComuns(formData: FormData) {
  return {
    nome: formData.get('nome') as string,
    pt: campoOuNull(formData, 'pt'),
    objetivo: campoOuNull(formData, 'objetivo'),
    frequencia: formData.get('frequencia') ? Number(formData.get('frequencia')) : null,
    alerta: (formData.get('alerta') as AlertaTipo) || 'Nenhum',
    detalhe: campoOuNull(formData, 'detalhe'),
    evento: campoOuNull(formData, 'evento'),
    evento_data: campoOuNull(formData, 'evento_data'),
    nascimento: campoOuNull(formData, 'nascimento'),
    telefone: campoOuNull(formData, 'telefone'),
  }
}

export async function criarCliente(formData: FormData) {
  const estudio = formData.get('estudio') as string
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...camposComuns(formData), estudio })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/painel/${estudio}/treinos/novo?error=${encodeURIComponent('Não foi possível criar o cliente.')}`
    )
  }

  revalidatePath(`/painel/${estudio}/treinos`)
  redirect(`/painel/${estudio}/treinos/${data.id}`)
}

export async function atualizarCliente(formData: FormData) {
  const id = formData.get('id') as string
  const estudio = formData.get('estudio') as string
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
      `/painel/${estudio}/treinos/${id}/editar?error=${encodeURIComponent('Não foi possível guardar as alterações.')}`
    )
  }

  revalidatePath(`/painel/${estudio}/treinos`)
  revalidatePath(`/painel/${estudio}/treinos/${id}`)
  redirect(`/painel/${estudio}/treinos/${id}`)
}
