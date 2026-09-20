'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function alternarAcesso(formData: FormData) {
  const slug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const perfilId = formData.get('perfil_id') as string
  const temAcesso = formData.get('tem_acesso') === '1'

  const supabase = await createClient()

  if (temAcesso) {
    await supabase
      .from('perfis_estudios')
      .delete()
      .eq('estudio_id', estudioId)
      .eq('perfil_id', perfilId)
  } else {
    await supabase
      .from('perfis_estudios')
      .insert({ estudio_id: estudioId, perfil_id: perfilId })
  }

  revalidatePath(`/painel/${slug}/equipa`)
  redirect(`/painel/${slug}/equipa`)
}
