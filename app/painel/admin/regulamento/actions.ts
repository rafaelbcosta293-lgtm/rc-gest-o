'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Mesma lógica de guardarConfig (../servicos/actions.ts), mas com
// redirect próprio — guardarConfig manda sempre de volta para
// /painel/admin/servicos, o que aqui seria confuso.
export async function guardarRegulamento(formData: FormData) {
  const valor = formData.get('valor')
  const supabase = await createClient()

  const { error } = await supabase
    .from('config')
    .update({ valor: typeof valor === 'string' ? valor : '' })
    .eq('chave', 'regulamento')

  if (error) {
    redirect(`/painel/admin/regulamento?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/regulamento')
  revalidatePath('/cliente/regulamento')
  redirect('/painel/admin/regulamento')
}
