'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
    redirect(`/painel/${estudioSlug}/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/admin/servicos`)
  redirect(`/painel/${estudioSlug}/admin/servicos`)
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
    redirect(`/painel/${estudioSlug}/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/admin/servicos`)
  redirect(`/painel/${estudioSlug}/admin/servicos`)
}

export async function apagarPlano(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('planos').delete().eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/admin/servicos`)
  redirect(`/painel/${estudioSlug}/admin/servicos`)
}
