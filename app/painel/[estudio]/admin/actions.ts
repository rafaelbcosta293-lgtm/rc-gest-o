'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export async function guardarConfig(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const chave = formData.get('chave') as string
  const valor = campoOuNull(formData, 'valor')
  const supabase = await createClient()

  const { error } = await supabase.from('config').update({ valor }).eq('chave', chave)

  if (error) {
    redirect(`/painel/${estudioSlug}/admin?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/admin`)
  redirect(`/painel/${estudioSlug}/admin`)
}
