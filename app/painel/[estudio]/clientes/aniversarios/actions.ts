'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function marcarEnviado(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const ano = Number(formData.get('ano'))
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('envios_aniversario').insert({
    cliente_id: clienteId,
    ano,
    enviado_por: userData.user?.id ?? null,
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/clientes/aniversarios?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/clientes/aniversarios`)
  redirect(`/painel/${estudioSlug}/clientes/aniversarios`)
}

export async function desfazerEnvio(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('envios_aniversario').delete().eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/clientes/aniversarios?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/clientes/aniversarios`)
  redirect(`/painel/${estudioSlug}/clientes/aniversarios`)
}
