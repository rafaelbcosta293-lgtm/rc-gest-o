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

// Auto-registo de horas dos PTs — cada um só regista e edita as suas
// próprias (a gestão de todos os registos da equipa fica em
// Coordenação, para quem tem acesso a essa área).
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
    redirect(`/painel/${estudioSlug}/horarios?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios`)
}

export async function atualizarMinhasHoras(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('registos_pt')
    .update({
      horas: Number(formData.get('horas')) || 0,
      treinos_40: Number(formData.get('treinos_40')) || 0,
      treinos_60: Number(formData.get('treinos_60')) || 0,
      nota: campoOuNull(formData, 'nota'),
    })
    .eq('id', id)
    .eq('pt_id', userData.user?.id ?? '')

  if (error) {
    redirect(`/painel/${estudioSlug}/horarios?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios`)
}

export async function apagarMinhasHoras(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('registos_pt')
    .delete()
    .eq('id', id)
    .eq('pt_id', userData.user?.id ?? '')

  if (error) {
    redirect(`/painel/${estudioSlug}/horarios?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios`)
}
