'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password !== confirmPassword) {
    redirect(
      `/atualizar-password?error=${encodeURIComponent('As palavras-passe não coincidem.')}`
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect(
      `/atualizar-password?error=${encodeURIComponent(traduzErroSupabase(error.message))}`
    )
  }

  redirect('/painel')
}
