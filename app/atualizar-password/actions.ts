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
    // O Supabase só bloqueia repetir a palavra-passe atual — não guarda
    // histórico, por isso uma palavra-passe antiga (não a atual) já é
    // aceite. Como isto não é um erro real, tratamos como sucesso: a
    // pessoa já sabe a palavra-passe certa, só falta entrar com ela.
    if (error.code === 'same_password') {
      await supabase.auth.signOut()
      redirect(
        `/login?info=${encodeURIComponent('Esta já é a tua palavra-passe atual. Já podes entrar.')}`
      )
    }
    redirect(
      `/atualizar-password?error=${encodeURIComponent(traduzErroSupabase(error.message))}`
    )
  }

  redirect('/painel')
}
