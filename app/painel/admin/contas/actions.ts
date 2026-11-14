'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { EMAIL_GERAL, EMAIL_POR_ESTUDIO } from '@/lib/data/acessos'
import { resolverIdPorEmail } from './dados'

const TAMANHO_MINIMO = 6

type Admin = ReturnType<typeof createAdminClient>

// Cria uma conta partilhada do negócio que ainda não exista. A da
// Coordenação fica como responsável (gestão) dos estúdios todos; a de
// um estúdio fica ligada só a esse estúdio. Devolve a mensagem de erro,
// ou null se correu bem.
async function criarContaPartilhada(admin: Admin, email: string, password: string): Promise<string | null> {
  const { data: estudios, error: erroEstudios } = await admin.from('estudios').select('id, nome, slug').eq('ativo', true)
  if (erroEstudios) return erroEstudios.message
  const ehGeral = email === EMAIL_GERAL.toLowerCase()
  const doEmail = (estudios ?? []).filter((e) => ehGeral || EMAIL_POR_ESTUDIO[e.slug as string]?.toLowerCase() === email)
  if (doEmail.length === 0) return 'Não encontrei o estúdio desta conta.'
  const nomeEstudio = String(doEmail[0].nome)
  const nome = ehGeral ? 'Coordenação' : nomeEstudio.startsWith('RC') ? nomeEstudio : `RC ${nomeEstudio}`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  })
  if (error || !data.user) return error?.message ?? 'Não foi possível criar a conta.'
  const id = data.user.id

  const { error: erroPerfil } = await admin
    .from('perfis')
    .upsert({ id, nome, papel: ehGeral ? 'studio_manager' : 'pt', ativo: true, saiu_em: null })
  if (erroPerfil) return erroPerfil.message
  const { error: erroApagar } = await admin.from('perfis_estudios').delete().eq('perfil_id', id)
  if (erroApagar) return erroApagar.message
  const { error: erroLigar } = await admin
    .from('perfis_estudios')
    .insert(doEmail.map((e) => ({ perfil_id: id, estudio_id: e.id })))
  return erroLigar?.message ?? null
}

export async function definirPasswordEstudio(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehAdmin) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Sem permissão para esta ação.')}`)
  }

  // Lista fechada: só as contas partilhadas do negócio (Coordenação e
  // estúdios), nunca a conta do dono — mesmo que alguém manipule o
  // campo "email" do formulário.
  const emailsPermitidos = [EMAIL_GERAL, ...Object.values(EMAIL_POR_ESTUDIO)].map((e) => e.toLowerCase())
  if (!emailsPermitidos.includes(email)) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent('Só é possível alterar as contas partilhadas do negócio.')}`)
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
    // A conta ainda não existe (foi o que aconteceu com a da
    // Coordenação): cria-se aqui, já confirmada e ligada aos estúdios
    // certos, para se poder entrar logo com esta palavra-passe.
    const erroCriar = await criarContaPartilhada(admin, email, password)
    if (erroCriar) {
      redirect(`/painel/admin/contas?error=${encodeURIComponent(erroCriar)}`)
    }
    redirect('/painel/admin/contas?sucesso=criada')
  }

  // ban_duration 'none' + email_confirm: uma conta partilhada nunca deve
  // ficar bloqueada nem por confirmar.
  const { error: erroAtualizar } = await admin.auth.admin.updateUserById(idUtilizador, {
    password,
    email_confirm: true,
    ban_duration: 'none',
  })
  if (erroAtualizar) {
    redirect(`/painel/admin/contas?error=${encodeURIComponent(erroAtualizar.message)}`)
  }

  // A Coordenação tem de estar ligada aos estúdios todos para ver os
  // dados de cada um — repõe as ligações que faltarem.
  if (email === EMAIL_GERAL.toLowerCase()) {
    const { data: estudios } = await admin.from('estudios').select('id').eq('ativo', true)
    const { error: erroLigar } = await admin
      .from('perfis_estudios')
      .upsert(
        (estudios ?? []).map((e) => ({ perfil_id: idUtilizador, estudio_id: e.id })),
        { onConflict: 'perfil_id,estudio_id', ignoreDuplicates: true }
      )
    if (erroLigar) {
      redirect(`/painel/admin/contas?error=${encodeURIComponent(erroLigar.message)}`)
    }
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
