'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export async function registarHoras(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('registos_pt').insert({
    pt_id: userData.user?.id,
    estudio_id: estudioId,
    data: formData.get('data') as string,
    horas: Number(formData.get('horas')) || 0,
    treinos_40: Number(formData.get('treinos_40')) || 0,
    treinos_60: Number(formData.get('treinos_60')) || 0,
    nota: campoOuNull(formData, 'nota'),
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/coordenacao?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/coordenacao`)
  redirect(`/painel/${estudioSlug}/coordenacao`)
}

export async function atualizarHoras(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('registos_pt')
    .update({
      horas: Number(formData.get('horas')) || 0,
      treinos_40: Number(formData.get('treinos_40')) || 0,
      treinos_60: Number(formData.get('treinos_60')) || 0,
      nota: campoOuNull(formData, 'nota'),
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/coordenacao?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/coordenacao`)
  redirect(`/painel/${estudioSlug}/coordenacao`)
}
