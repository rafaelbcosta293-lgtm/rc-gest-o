'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { EMAIL_POR_ESTUDIO } from '@/lib/data/acessos'

const TAMANHO_MINIMO = 6

export async function definirPasswordEstudio(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehAdmin) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Sem permissão para esta ação.')}`)
  }

  // Lista fechada: só as contas de login dos estúdios, nunca uma conta
  // admin — mesmo que alguém manipule o campo "email" do formulário.
  const emailsPermitidos = Object.values(EMAIL_POR_ESTUDIO).map((e) => e.toLowerCase())
  if (!emailsPermitidos.includes(email)) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Só é possível alterar as contas dos estúdios.')}`)
  }

  if (password !== confirmPassword) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('As palavras-passe não coincidem.')}`)
  }
  if (password.length < TAMANHO_MINIMO) {
    redirect(
      `/painel/admin/contas?error=${encodeURIComponent(`A palavra-passe deve ter pelo menos ${TAMANHO_MINIMO} caracteres.`)}`
    )
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent((e as Error).message)}`)
  }

  const { data: lista, error: erroListar } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (erroListar) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent(erroListar.message)}`)
  }

  const utilizador = lista.users.find((u) => (u.email ?? '').toLowerCase() === email)
  if (!utilizador) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Conta não encontrada.')}`)
  }

  const { error: erroAtualizar } = await admin.auth.admin.updateUserById(utilizador.id, { password })
  if (erroAtualizar) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent(erroAtualizar.message)}`)
  }

  redirect('/painel/admin/contas?sucesso=1')
}
