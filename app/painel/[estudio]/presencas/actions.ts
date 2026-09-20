'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function marcarPresenca(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const data = formData.get('data') as string
  const estado = formData.get('estado') as string
  const nota = (formData.get('nota') as string) || null

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  // Um só registo de presença por cliente e por dia: substitui o que
  // já existisse (manual ou ligado a um treino) por este novo registo.
  await supabase.from('presencas').delete().match({ cliente_id: clienteId, data })

  await supabase.from('presencas').insert({
    cliente_id: clienteId,
    data,
    estado,
    pt_id: userData.user?.id ?? null,
    nota,
  })

  revalidatePath(`/painel/${estudioSlug}/presencas/${clienteId}`)
  redirect(`/painel/${estudioSlug}/presencas/${clienteId}`)
}

export async function apagarPresenca(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string

  const supabase = await createClient()
  await supabase.from('presencas').delete().eq('id', id)

  revalidatePath(`/painel/${estudioSlug}/presencas/${clienteId}`)
  redirect(`/painel/${estudioSlug}/presencas/${clienteId}`)
}
