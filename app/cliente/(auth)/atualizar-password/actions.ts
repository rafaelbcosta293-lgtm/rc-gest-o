'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'

export async function atualizarPasswordCliente(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password !== confirmPassword) {
    redirect(
      `/cliente/atualizar-password?error=${encodeURIComponent('As palavras-passe não coincidem.')}`
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    if (error.code === 'same_password') {
      await supabase.auth.signOut()
      redirect(
        `/cliente/entrar?error=${encodeURIComponent('Esta já é a tua palavra-passe atual. Já podes entrar.')}`
      )
    }
    redirect(
      `/cliente/atualizar-password?error=${encodeURIComponent(traduzErroSupabase(error.message))}`
    )
  }

  redirect('/cliente')
}
