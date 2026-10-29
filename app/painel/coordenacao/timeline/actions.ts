'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function criarMarco(formData: FormData) {
  const estudioId = formData.get('estudio_id') as string
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('marcos_empresa').insert({
    estudio_id: estudioId ? Number(estudioId) : null,
    tipo: formData.get('tipo') as string,
    titulo: formData.get('titulo') as string,
    descricao: (formData.get('descricao') as string) || null,
    data: formData.get('data') as string,
    criado_por: userData.user?.id ?? null,
  })

  if (error) {
    redirect(`/painel/coordenacao/timeline?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/coordenacao/timeline')
  redirect('/painel/coordenacao/timeline')
}

export async function apagarMarco(formData: FormData) {
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('marcos_empresa').delete().eq('id', id)
  if (error) {
    redirect(`/painel/coordenacao/timeline?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/coordenacao/timeline')
  redirect('/painel/coordenacao/timeline')
}
