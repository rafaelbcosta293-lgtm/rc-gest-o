'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { EMAIL_POR_ESTUDIO } from '@/lib/data/acessos'
import { resolverIdPorEmail } from './dados'

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

  const idUtilizador = await resolverIdPorEmail(email)
  if (!idUtilizador) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Conta não encontrada.')}`)
  }

  const { error: erroAtualizar } = await admin.auth.admin.updateUserById(idUtilizador, { password })
  if (erroAtualizar) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent(erroAtualizar.message)}`)
  }

  redirect('/painel/admin/contas?sucesso=1')
}

// Corrige a ligação estúdio ↔ conta: apaga todas as ligações atuais
// desta conta e volta a pôr só a do estúdio certo — garante que uma
// conta de estúdio nunca fica ligada a dois estúdios ao mesmo tempo
// (foi exatamente isto que aconteceu com a conta de Fátima, ligada por
// engano ao estúdio de Leiria).
export async function corrigirAcessoEstudio(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()
  const estudioId = Number(formData.get('estudio_id'))

  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehAdmin) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Sem permissão para esta ação.')}`)
  }

  const emailsPermitidos = Object.values(EMAIL_POR_ESTUDIO).map((e) => e.toLowerCase())
  if (!emailsPermitidos.includes(email)) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Só é possível corrigir as contas dos estúdios.')}`)
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent((e as Error).message)}`)
  }

  const idUtilizador = await resolverIdPorEmail(email)
  if (!idUtilizador) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Conta não encontrada.')}`)
  }

  const { error: erroApagar } = await admin
    .from('perfis_estudios')
    .delete()
    .eq('perfil_id', idUtilizador)
  if (erroApagar) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent(erroApagar.message)}`)
  }

  const { error: erroInserir } = await admin
    .from('perfis_estudios')
    .insert({ perfil_id: idUtilizador, estudio_id: estudioId })
  if (erroInserir) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent(erroInserir.message)}`)
  }

  redirect('/painel/admin/contas?sucessoAcesso=1')
}
