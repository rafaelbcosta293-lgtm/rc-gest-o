'use server'

import { randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa, emailPerfilSemConta, ehEmailSemConta } from '@/lib/data/acessos'
import { MODULOS } from '@/lib/data/constantes'

// Gestão de instrutores pela Administração: perfis (sem acesso à app) e
// contas (com email, palavra-passe e permissões). Tudo com o cliente de
// administração, por isso cada ação confirma primeiro que quem pede é
// mesmo administrador.

// "admin" fica de fora de propósito: a Administração é só a conta do dono.
const PAPEIS = ['pt', 'master_trainer', 'comercial', 'studio_manager'] as const
const TAMANHO_MINIMO = 6
const BLOQUEADO = '876000h' // ~100 anos: o login fica impossível
const DESTINO = '/painel/admin/contas'

function voltar(params: Record<string, string>): never {
  revalidatePath(DESTINO)
  redirect(`${DESTINO}?${new URLSearchParams(params).toString()}#equipa`)
}

async function exigirAdmin() {
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehAdmin) voltar({ error: 'Sem permissão para esta ação.' })
  try {
    return { sessao, admin: createAdminClient() }
  } catch (e) {
    voltar({ error: (e as Error).message })
  }
}

function lerPermissoes(formData: FormData) {
  const validos = new Set(MODULOS.map((m) => m.id))
  return {
    modulos: formData.getAll('modulos').map(String).filter((m) => validos.has(m)),
    agenda_escrita: formData.get('agenda_escrita') === '1',
  }
}

function lerPapel(formData: FormData) {
  const papel = String(formData.get('papel') ?? 'pt')
  return (PAPEIS as readonly string[]).includes(papel) ? papel : 'pt'
}

type Admin = ReturnType<typeof createAdminClient>

async function definirEstudios(admin: Admin, perfilId: string, estudios: number[]) {
  const { error: erroApagar } = await admin.from('perfis_estudios').delete().eq('perfil_id', perfilId)
  if (erroApagar) return erroApagar.message
  if (estudios.length === 0) return null
  const { error } = await admin.from('perfis_estudios').insert(estudios.map((estudio_id) => ({ perfil_id: perfilId, estudio_id })))
  return error?.message ?? null
}

// A conta alvo nunca pode ser uma das 4 contas fixas do negócio nem a
// de quem está a fazer a alteração.
async function contaAlvo(admin: Admin, id: string, sessaoUserId: string | null) {
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error || !data.user) voltar({ error: 'Conta não encontrada.' })
  if (ehContaFixa(data.user.email ?? null)) voltar({ error: 'As contas fixas do negócio não se alteram aqui.' })
  if (id === sessaoUserId) voltar({ error: 'Não podes alterar a tua própria conta aqui.' })
  return data.user
}

export async function criarInstrutor(formData: FormData) {
  const { admin } = await exigirAdmin()
  const nome = String(formData.get('nome') ?? '').trim()
  const telefone = String(formData.get('telefone') ?? '').trim() || null
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const estudios = formData.getAll('estudios').map(Number).filter(Number.isInteger)
  if (!nome) voltar({ error: 'Indica o nome do instrutor.' })
  const comConta = email !== ''
  if (comConta && password.length < TAMANHO_MINIMO) {
    voltar({ error: `Para criar a conta, a palavra-passe tem de ter pelo menos ${TAMANHO_MINIMO} caracteres.` })
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: comConta ? email : emailPerfilSemConta(randomBytes(8).toString('hex')),
    password: comConta ? password : randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: { nome },
    app_metadata: comConta ? lerPermissoes(formData) : { sem_conta: true },
  })
  if (error || !data.user) voltar({ error: error?.message ?? 'Não foi possível criar o instrutor.' })
  const id = data.user.id
  if (!comConta) {
    const { error: erroBloqueio } = await admin.auth.admin.updateUserById(id, { ban_duration: BLOQUEADO })
    if (erroBloqueio) voltar({ error: erroBloqueio.message })
  }

  const { error: erroPerfil } = await admin
    .from('perfis')
    .upsert({ id, nome, telefone, papel: lerPapel(formData), ativo: true, saiu_em: null })
  if (erroPerfil) voltar({ error: erroPerfil.message })
  const erroEstudios = await definirEstudios(admin, id, estudios)
  if (erroEstudios) voltar({ error: erroEstudios })
  voltar({ ok: comConta ? 'conta-criada' : 'perfil-criado' })
}

export async function atualizarInstrutor(formData: FormData) {
  const { admin, sessao } = await exigirAdmin()
  const id = String(formData.get('id') ?? '')
  const alvo = await contaAlvo(admin, id, sessao.userId)
  const nome = String(formData.get('nome') ?? '').trim()
  if (!nome) voltar({ error: 'O nome não pode ficar em branco.' })
  const telefone = String(formData.get('telefone') ?? '').trim() || null
  const estudios = formData.getAll('estudios').map(Number).filter(Number.isInteger)

  const { error: erroPerfil } = await admin.from('perfis').update({ nome, telefone, papel: lerPapel(formData) }).eq('id', id)
  if (erroPerfil) voltar({ error: erroPerfil.message })
  const erroEstudios = await definirEstudios(admin, id, estudios)
  if (erroEstudios) voltar({ error: erroEstudios })
  if (!ehEmailSemConta(alvo.email ?? null)) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      app_metadata: { ...alvo.app_metadata, ...lerPermissoes(formData) },
    })
    if (error) voltar({ error: error.message })
  }
  voltar({ ok: 'guardado' })
}

// Dá acesso à app a um perfil (ou muda o email/palavra-passe de uma conta).
export async function definirAcesso(formData: FormData) {
  const { admin, sessao } = await exigirAdmin()
  const id = String(formData.get('id') ?? '')
  const alvo = await contaAlvo(admin, id, sessao.userId)
  const semConta = ehEmailSemConta(alvo.email ?? null)
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (semConta && !email) voltar({ error: 'Indica o email para criar o acesso.' })
  if ((semConta || password) && password.length < TAMANHO_MINIMO) {
    voltar({ error: `A palavra-passe tem de ter pelo menos ${TAMANHO_MINIMO} caracteres.` })
  }
  const { error } = await admin.auth.admin.updateUserById(id, {
    ...(email ? { email, email_confirm: true } : {}),
    ...(password ? { password } : {}),
    ban_duration: 'none',
    app_metadata: { ...alvo.app_metadata, sem_conta: false },
  })
  if (error) voltar({ error: error.message })
  voltar({ ok: semConta ? 'acesso-criado' : 'acesso-atualizado' })
}

// Tira o acesso à app mas mantém o perfil (escalas, horas, histórico).
export async function removerAcesso(formData: FormData) {
  const { admin, sessao } = await exigirAdmin()
  const id = String(formData.get('id') ?? '')
  const alvo = await contaAlvo(admin, id, sessao.userId)
  const { error } = await admin.auth.admin.updateUserById(id, {
    email: emailPerfilSemConta(randomBytes(8).toString('hex')),
    email_confirm: true,
    password: randomBytes(24).toString('base64url'),
    ban_duration: BLOQUEADO,
    app_metadata: { ...alvo.app_metadata, sem_conta: true },
  })
  if (error) voltar({ error: error.message })
  voltar({ ok: 'acesso-removido' })
}

// Desativar: sai de todos os estúdios e deixa de poder entrar, mas o
// histórico (treinos, horas, férias) continua com o nome dele.
export async function desativarInstrutor(formData: FormData) {
  const { admin, sessao } = await exigirAdmin()
  const id = String(formData.get('id') ?? '')
  await contaAlvo(admin, id, sessao.userId)
  const reativar = formData.get('reativar') === '1'
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  const { error: erroPerfil } = await admin
    .from('perfis')
    .update(reativar ? { ativo: true, saiu_em: null } : { ativo: false, saiu_em: hoje })
    .eq('id', id)
  if (erroPerfil) voltar({ error: erroPerfil.message })
  if (!reativar) {
    const erroEstudios = await definirEstudios(admin, id, [])
    if (erroEstudios) voltar({ error: erroEstudios })
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: BLOQUEADO })
    if (error) voltar({ error: error.message })
  }
  voltar({ ok: reativar ? 'reativado' : 'desativado' })
}

// Eliminar de vez. Se a base de dados recusar (o instrutor tem histórico
// que depende dele), fica desativado em vez de se perder esse histórico.
export async function eliminarInstrutor(formData: FormData) {
  const { admin, sessao } = await exigirAdmin()
  const id = String(formData.get('id') ?? '')
  await contaAlvo(admin, id, sessao.userId)
  const { error } = await admin.auth.admin.deleteUser(id)
  if (!error) voltar({ ok: 'eliminado' })

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  await admin.from('perfis').update({ ativo: false, saiu_em: hoje }).eq('id', id)
  await definirEstudios(admin, id, [])
  await admin.auth.admin.updateUserById(id, { ban_duration: BLOQUEADO })
  voltar({ ok: 'desativado-com-historico' })
}
