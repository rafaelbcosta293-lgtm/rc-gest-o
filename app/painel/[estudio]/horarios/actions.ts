'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export async function criarAusencia(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const semana = formData.get('semana') as string
  const supabase = await createClient()

  const { error } = await supabase.from('ausencias').insert({
    pt_id: formData.get('pt_id') as string,
    inicio: formData.get('inicio') as string,
    fim: formData.get('fim') as string,
    tipo: formData.get('tipo') as string,
    nota: campoOuNull(formData, 'nota'),
  })

  if (error) {
    redirect(
      `/painel/${estudioSlug}/horarios?semana=${semana}&error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios?semana=${semana}`)
}

export async function apagarAusencia(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const semana = formData.get('semana') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('ausencias').delete().eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/horarios?semana=${semana}&error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios?semana=${semana}`)
}
