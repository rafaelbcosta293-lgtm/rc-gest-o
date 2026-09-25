'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(traduzErroSupabase(error.message))}`)
  }

  revalidatePath('/', 'layout')

  // Quem é admin não precisa de passar pela grelha de módulos — vai
  // direto para a Administração, já combinada para todos os estúdios.
  const sessao = await getSessaoAtual()
  const { ehAdmin } = papeisDaSessao(sessao)
  if (ehAdmin) {
    redirect('/painel/admin')
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
