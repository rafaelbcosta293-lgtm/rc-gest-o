'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// "destino" deixa este toggle ser usado tanto na página Equipa como
// dentro de Coordenação (para gerir quem entra na escala) — volta
// sempre para onde foi chamado. Coordenação já não é por estúdio, por
// isso esse destino é a página combinada, sem o slug à frente.
export async function alternarAcesso(formData: FormData) {
  const slug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const perfilId = formData.get('perfil_id') as string
  const temAcesso = formData.get('tem_acesso') === '1'
  const destino = (formData.get('destino') as string) || 'equipa'
  const caminhoDestino = destino === 'coordenacao' ? '/painel/coordenacao' : `/painel/${slug}/${destino}`

  const supabase = await createClient()

  const { error } = temAcesso
    ? await supabase
        .from('perfis_estudios')
        .delete()
        .eq('estudio_id', estudioId)
        .eq('perfil_id', perfilId)
    : await supabase.from('perfis_estudios').insert({ estudio_id: estudioId, perfil_id: perfilId })

  if (error) {
    redirect(`${caminhoDestino}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${slug}/equipa`)
  revalidatePath('/painel/coordenacao')
  redirect(caminhoDestino)
}

export async function mudarPapel(formData: FormData) {
  const slug = formData.get('estudio_slug') as string
  const perfilId = formData.get('perfil_id') as string
  const papel = formData.get('papel') as string

  const supabase = await createClient()
  const { error } = await supabase.from('perfis').update({ papel }).eq('id', perfilId)

  if (error) {
    redirect(`/painel/${slug}/equipa?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${slug}/equipa`)
  redirect(`/painel/${slug}/equipa`)
}
