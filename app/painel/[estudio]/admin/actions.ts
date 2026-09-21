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

export async function criarPlano(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const supabase = await createClient()

  const { error } = await supabase.from('planos').insert({
    nome: formData.get('nome') as string,
    valor: Number(formData.get('valor')),
    sessoes_por_semana: formData.get('sessoes_por_semana')
      ? Number(formData.get('sessoes_por_semana'))
      : null,
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/admin?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/admin`)
  redirect(`/painel/${estudioSlug}/admin`)
}

export async function atualizarPlano(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('planos')
    .update({
      nome: formData.get('nome') as string,
      valor: Number(formData.get('valor')),
      sessoes_por_semana: formData.get('sessoes_por_semana')
        ? Number(formData.get('sessoes_por_semana'))
        : null,
      ativo: formData.get('ativo') === 'on',
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/admin?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/admin`)
  redirect(`/painel/${estudioSlug}/admin`)
}
