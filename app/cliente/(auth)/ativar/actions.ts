'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'

const TAMANHO_MINIMO = 6

export async function ativarConta(formData: FormData) {
  const clienteId = formData.get('cliente_id') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  const erro = (mensagem: string) =>
    redirect(`/cliente/ativar?cliente_id=${clienteId}&error=${encodeURIComponent(mensagem)}`)

  if (password !== confirmPassword) {
    erro('As palavras-passe não coincidem.')
  }
  if (password.length < TAMANHO_MINIMO) {
    erro(`A palavra-passe deve ter pelo menos ${TAMANHO_MINIMO} caracteres.`)
  }

  const supabase = await createClient()
  const { data: userData, error: erroUser } = await supabase.auth.getUser()
  if (erroUser || !userData.user?.email) {
    erro('A tua sessão de convite expirou — pede à equipa para enviar um novo convite.')
    return
  }

  const { error: erroPassword } = await supabase.auth.updateUser({ password })
  if (erroPassword) {
    erro(traduzErroSupabase(erroPassword.message))
    return
  }

  // Confirma que o convite é mesmo para esta ficha antes de ligar a
  // conta — usa o admin client porque, sem auth_user_id ainda definido,
  // a RLS normal não deixa este utilizador ler nenhuma ficha de cliente.
  const admin = createAdminClient()
  const { data: cliente, error: erroCliente } = await admin
    .from('clientes')
    .select('id, email, auth_user_id')
    .eq('id', clienteId)
    .maybeSingle()

  if (erroCliente || !cliente) {
    erro('Convite inválido.')
    return
  }
  if ((cliente.email ?? '').toLowerCase() !== userData.user.email.toLowerCase()) {
    erro('Este convite não corresponde à tua conta.')
    return
  }
  if (cliente.auth_user_id && cliente.auth_user_id !== userData.user.id) {
    erro('Esta ficha já está ligada a outra conta — contacta o ginásio.')
    return
  }

  const { error: erroLigar } = await admin
    .from('clientes')
    .update({ auth_user_id: userData.user.id })
    .eq('id', clienteId)
  if (erroLigar) {
    erro(erroLigar.message)
    return
  }

  redirect('/cliente')
}
