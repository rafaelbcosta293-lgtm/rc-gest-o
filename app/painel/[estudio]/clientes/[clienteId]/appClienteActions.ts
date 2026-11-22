'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { primeiroNomeExibicao } from '@/lib/data/clientes'
import { enviarSms, normalizarTelefoneSms } from '@/lib/sms/gateway'
import { appClientesConfigurada, ligarAppClientes, urlAppClientes } from '@/lib/appClientes/ligacao'
import { DIAS_CONVITE, gerarCodigo, linkAtivacao, mensagemConvite } from '@/lib/appClientes/convite'

// Convite / desativação do acesso de um cliente à app do cliente. Só a
// gestão do estúdio. A conta é criada na base de dados da APP (separada)
// através das funções sync_* — esta ação corre no servidor da gestão.

function voltar(slug: string, clienteId: string, qs: Record<string, string>): never {
  redirect(`/painel/${slug}/clientes/${clienteId}?${new URLSearchParams(qs)}#app-cliente`)
}

export async function convidarParaApp(formData: FormData) {
  const slug = String(formData.get('estudio_slug'))
  const clienteId = String(formData.get('cliente_id'))
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehGestao) voltar(slug, clienteId, { error: 'Só a gestão pode dar acesso à app.' })
  if (!appClientesConfigurada()) voltar(slug, clienteId, { error: 'A app do cliente ainda não está configurada.' })

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  // Lido com as permissões de quem está a usar (garante acesso a este estúdio).
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, nome_preferido, numero_socio, telefone, estudio_id')
    .eq('id', clienteId)
    .maybeSingle()
  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) voltar(slug, clienteId, { error: 'Cliente não encontrado.' })
  if (!cliente.numero_socio) voltar(slug, clienteId, { error: 'O cliente ainda não tem nº de cliente.' })
  if (!normalizarTelefoneSms(cliente.telefone)) voltar(slug, clienteId, { error: 'O cliente não tem um telemóvel válido para receber o convite.' })

  const admin = createAdminClient()
  const { data: existente } = await admin.from('app_clientes_contas').select('conta_id, ativa').eq('cliente_id', clienteId).maybeSingle()
  const { app, token } = ligarAppClientes()
  const codigo = gerarCodigo()
  const nome = primeiroNomeExibicao(cliente.nome, cliente.nome_preferido)
  const { data: contaId, error } = await app.rpc('sync_criar_conta', {
    p_token: token,
    p_numero: cliente.numero_socio,
    p_estudio_slug: estudio.slug,
    p_estudio_nome: estudio.nome,
    p_nome: nome,
    p_codigo: codigo,
    p_dias: DIAS_CONVITE,
  })
  if (error || !contaId) voltar(slug, clienteId, { error: `Não foi possível criar a conta: ${error?.message ?? 'sem resposta'}` })

  const { error: erroReg } = await admin.from('app_clientes_contas').upsert({
    cliente_id: clienteId,
    conta_id: contaId as string,
    numero: cliente.numero_socio,
    estudio_id: estudio.id,
    convidado_em: new Date().toISOString(),
    convidado_por: sessao.perfil?.id ?? null,
    ativa: true,
    desativada_em: null,
    hash_dados: null,
    sincronizado_em: null,
  })
  if (erroReg) voltar(slug, clienteId, { error: erroReg.message })

  const link = linkAtivacao(urlAppClientes(), cliente.numero_socio, codigo)
  const r = await enviarSms(estudio.slug, cliente.telefone!, mensagemConvite(nome, cliente.numero_socio, link, !!existente))
  revalidatePath(`/painel/${slug}/clientes/${clienteId}`)
  if (!r.ok) voltar(slug, clienteId, { app: 'sms-falhou', link, motivo: r.mensagem })
  voltar(slug, clienteId, { app: 'convidado' })
}

export async function desativarAcessoApp(formData: FormData) {
  const slug = String(formData.get('estudio_slug'))
  const clienteId = String(formData.get('cliente_id'))
  if (!papeisDaSessao(await getSessaoAtual()).ehGestao) voltar(slug, clienteId, { error: 'Só a gestão pode tirar o acesso à app.' })
  const supabase = await createClient()
  const { data: conta } = await supabase.from('app_clientes_contas').select('conta_id').eq('cliente_id', clienteId).maybeSingle()
  if (!conta) voltar(slug, clienteId, { error: 'Este cliente não tem conta na app.' })
  const { app, token } = ligarAppClientes()
  const { error } = await app.rpc('sync_desativar_conta', { p_token: token, p_conta: conta.conta_id })
  if (error) voltar(slug, clienteId, { error: `Não foi possível desativar: ${error.message}` })
  await createAdminClient()
    .from('app_clientes_contas')
    .update({ ativa: false, desativada_em: new Date().toISOString(), hash_dados: null })
    .eq('cliente_id', clienteId)
  revalidatePath(`/painel/${slug}/clientes/${clienteId}`)
  voltar(slug, clienteId, { app: 'desativado' })
}
