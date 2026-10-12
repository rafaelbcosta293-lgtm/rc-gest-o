'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function estudioIdOuNull(formData: FormData) {
  const v = formData.get('estudio_id')
  if (typeof v !== 'string' || v === '') return null
  return Number(v)
}

export async function criarEvento(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('eventos').insert({
    titulo: formData.get('titulo') as string,
    corpo: formData.get('corpo') as string,
    estudio_id: estudioIdOuNull(formData),
    publicado: formData.get('publicado') === 'on',
  })

  if (error) {
    redirect(`/painel/coordenacao/eventos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/coordenacao/eventos')
  redirect('/painel/coordenacao/eventos')
}

export async function atualizarEvento(formData: FormData) {
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('eventos')
    .update({
      titulo: formData.get('titulo') as string,
      corpo: formData.get('corpo') as string,
      estudio_id: estudioIdOuNull(formData),
      publicado: formData.get('publicado') === 'on',
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/coordenacao/eventos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/coordenacao/eventos')
  redirect('/painel/coordenacao/eventos')
}

export async function apagarEvento(formData: FormData) {
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('eventos').delete().eq('id', id)

  if (error) {
    redirect(`/painel/coordenacao/eventos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/coordenacao/eventos')
  redirect('/painel/coordenacao/eventos')
}
