'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function pedirRecuperacaoCliente(formData: FormData) {
  const email = formData.get('email') as string

  const supabase = await createClient()
  const origin = (await headers()).get('origin')

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/cliente/atualizar-password`,
  })

  // Mostra sempre a mesma mensagem, exista ou não essa conta, para não
  // revelar a quem tem ou não uma conta registada.
  redirect(
    `/cliente/recuperar-password?success=${encodeURIComponent('Se existir uma conta com esse email, foi enviado um link para repor a palavra-passe.')}`
  )
}
