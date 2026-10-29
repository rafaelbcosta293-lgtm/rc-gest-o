'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function guardarCenario(formData: FormData) {
  const nome = formData.get('nome') as string
  const entradas = JSON.parse(formData.get('entradas') as string)
  const resultados = JSON.parse(formData.get('resultados') as string)
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('cenarios_simulador')
    .insert({ nome, entradas, resultados, criado_por: userData.user?.id ?? null })

  if (error) {
    redirect(`/painel/admin/simulador?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/simulador')
  redirect('/painel/admin/simulador')
}

export async function apagarCenario(formData: FormData) {
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('cenarios_simulador').delete().eq('id', id)
  if (error) {
    redirect(`/painel/admin/simulador?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/simulador')
  redirect('/painel/admin/simulador')
}
