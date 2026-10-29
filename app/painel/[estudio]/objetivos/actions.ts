'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function definirMeta(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const ano = Number(formData.get('ano'))
  const mes = Number(formData.get('mes'))
  const metrica = formData.get('metrica') as string
  const meta = Number(formData.get('meta'))
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('goals')
    .upsert(
      { estudio_id: estudioId, ano, mes, metrica, meta, criado_por: userData.user?.id ?? null },
      { onConflict: 'estudio_id,ano,mes,metrica' }
    )

  if (error) {
    redirect(`/painel/${estudioSlug}/objetivos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/objetivos`)
  redirect(`/painel/${estudioSlug}/objetivos`)
}

export async function apagarMeta(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) {
    redirect(`/painel/${estudioSlug}/objetivos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/objetivos`)
  redirect(`/painel/${estudioSlug}/objetivos`)
}
