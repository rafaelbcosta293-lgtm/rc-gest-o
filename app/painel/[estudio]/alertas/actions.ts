'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function marcarVisto(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('alerts').update({ estado: 'Visto' }).eq('id', id)
  if (error) {
    redirect(`/painel/${estudioSlug}/alertas?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/alertas`)
  redirect(`/painel/${estudioSlug}/alertas`)
}

export async function resolverAlerta(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('alerts')
    .update({ estado: 'Resolvido', resolvido_em: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    redirect(`/painel/${estudioSlug}/alertas?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/alertas`)
  redirect(`/painel/${estudioSlug}/alertas`)
}

export async function adiarAlerta(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const adiadoAte = formData.get('adiado_ate') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('alerts')
    .update({ estado: 'Adiado', adiado_ate: adiadoAte })
    .eq('id', id)
  if (error) {
    redirect(`/painel/${estudioSlug}/alertas?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/alertas`)
  redirect(`/painel/${estudioSlug}/alertas`)
}
