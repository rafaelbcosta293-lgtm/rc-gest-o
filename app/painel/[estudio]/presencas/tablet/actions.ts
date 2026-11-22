'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'

const caminho = (slug: string) => `/painel/${slug}/presencas/tablet`

// Só a gestão (a RLS de checkin_postos também o garante).
export async function criarPostoCheckin(formData: FormData) {
  const slug = String(formData.get('estudio_slug'))
  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) redirect(`${caminho(slug)}?error=${encodeURIComponent('Estúdio não encontrado.')}`)
  const nome = String(formData.get('nome') ?? '').trim() || 'Tablet da receção'
  const { error } = await supabase.from('checkin_postos').insert({ estudio_id: estudio.id, nome })
  if (error) redirect(`${caminho(slug)}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(caminho(slug))
  redirect(caminho(slug))
}

// Desativa o link (ex.: tablet perdido, ou o link foi parar a quem não devia).
export async function desativarPostoCheckin(formData: FormData) {
  const slug = String(formData.get('estudio_slug'))
  const id = String(formData.get('id'))
  const supabase = await createClient()
  const { error } = await supabase.from('checkin_postos').update({ revogado_em: new Date().toISOString() }).eq('id', id)
  if (error) redirect(`${caminho(slug)}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(caminho(slug))
  redirect(caminho(slug))
}

