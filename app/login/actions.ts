'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(traduzErroSupabase(error.message))}`)
  }

  revalidatePath('/', 'layout')

  // Quem tem acesso à Administração não precisa de passar pela grelha de
  // módulos — vai direto para lá, já combinada para todos os estúdios.
  const sessao = await getSessaoAtual()
  if (podeAcederAdmin(sessao.email)) {
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
