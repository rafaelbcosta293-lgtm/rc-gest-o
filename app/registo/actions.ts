'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'

export async function signup(formData: FormData) {
  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password !== confirmPassword) {
    redirect(
      `/registo?error=${encodeURIComponent('As palavras-passe não coincidem.')}`
    )
  }

  const supabase = await createClient()
  const origin = (await headers()).get('origin')

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  })

  if (error) {
    redirect(`/registo?error=${encodeURIComponent(traduzErroSupabase(error.message))}`)
  }

  redirect(
    `/registo?success=${encodeURIComponent('Conta criada! Verifica o teu email para confirmar antes de entrares.')}`
  )
}
