'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'

export async function entrarCliente(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = formData.get('next') as string | null

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/cliente/entrar?error=${encodeURIComponent(traduzErroSupabase(error.message))}`)
  }

  // Só segue "next" se apontar mesmo para dentro de /cliente — nunca
  // para um URL externo (ex.: alguém a manipular o parâmetro à mão).
  redirect(next && next.startsWith('/cliente') ? next : '/cliente')
}
