'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { tentarDesbloquear } from '@/lib/data/gate'

export async function desbloquearAdmin(formData: FormData) {
  const destino = (formData.get('destino') as string) || '/painel/admin'
  const senha = formData.get('senha') as string
  const supabase = await createClient()

  const ok = await tentarDesbloquear(supabase, 'admin', senha)
  if (!ok) {
    redirect(`${destino}?erroSenha=1`)
  }

  redirect(destino)
}
