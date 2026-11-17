import type { SupabaseClient } from '@supabase/supabase-js'
import { getEstudios } from './estudios'
import type { Estudio, EstadoSmsGateway } from '@/lib/supabase/database.types'

// Estado e alertas do gateway de SMS, partilhados por tudo o que envia
// SMS por este canal (lembretes de treino, parabéns de aniversário) —
// é o mesmo telemóvel por estúdio, por isso uma falha de ligação é uma
// única "crise" por estúdio, não uma por funcionalidade.

// A partir de quantas passagens falhadas seguidas se considera "offline"
// a sério — é o mesmo limiar que decide quando a faixa vermelha e o
// alerta aparecem. Basta 1: cada passagem já volta a tentar sozinha
// (ver TENTATIVAS_SE_OFFLINE em lembretesSms.ts) antes de contar como
// falha, por isso um soluço passageiro de rede nunca chega aqui.
export const LIMIAR_CRISE = 1
const REGRA_GATEWAY_OFFLINE = 'sms_gateway_offline'

export type ResultadoEstudio = {
  estudioSlug: string
  estudioNome: string
  enviados: number
  falhasPorNumero: number
  pendentesRestantes: number
  gatewayOffline: boolean
}

// Estado que a faixa vermelha e o painel precisam de saber, por
// estúdio — "offline" só fica verdadeiro a partir do limiar de crise,
// não ao primeiro soluço.
export type EstadoBannerGatewayEstudio = {
  estudioSlug: string
  estudioNome: string
  offline: boolean
  desde: string | null
}

export function emCrise(estado: Pick<EstadoSmsGateway, 'tentativas_falhadas' | 'offline_desde'>): boolean {
  return estado.tentativas_falhadas >= LIMIAR_CRISE && estado.offline_desde !== null
}

export async function obterEstadosBanner(supabase: SupabaseClient): Promise<EstadoBannerGatewayEstudio[]> {
  const [estudios, { data: estadosData }] = await Promise.all([
    getEstudios(supabase),
    supabase.from('estado_sms_gateway').select('estudio_id, tentativas_falhadas, offline_desde'),
  ])
  const porEstudioId = new Map((estadosData ?? []).map((e) => [e.estudio_id, e]))

  return estudios.map((estudio) => {
    const linha = porEstudioId.get(estudio.id)
    const offline = !!linha && emCrise(linha)
    return {
      estudioSlug: estudio.slug,
      estudioNome: estudio.nome,
      offline,
      desde: offline ? (linha!.offline_desde as string) : null,
    }
  })
}

export async function obterEstadoGateway(admin: SupabaseClient, estudioId: number): Promise<EstadoSmsGateway> {
  const { data, error } = await admin.from('estado_sms_gateway').select('*').eq('estudio_id', estudioId).single()
  if (error) throw new Error(error.message)
  return data as EstadoSmsGateway
}

// Cria um alerta "Crítico" (visível em Centro de alertas, só para
// gestão) para este estúdio. Idempotente: só é chamada uma vez por
// "crise" (ver alerta_registado_em em registarFalhaGateway).
async function registarAlertaGatewayOffline(admin: SupabaseClient, estudio: Pick<Estudio, 'id' | 'nome'>) {
  await admin.from('alerts').insert({
    estudio_id: estudio.id,
    regra_chave: REGRA_GATEWAY_OFFLINE,
    severidade: 'Crítico' as const,
    titulo: `SMS Gateway (${estudio.nome}) offline — as mensagens por SMS não estão a ser enviadas`,
    descricao:
      `O telemóvel que envia SMS (lembretes de treino, parabéns de aniversário) em ${estudio.nome} não ` +
      'respondeu, nem depois de tentar de novo. Verifica se está ligado, com bateria, com rede e com a app ' +
      'do gateway aberta, e depois usa o botão de reenvio no painel correspondente (Lembretes SMS ou ' +
      'Aniversários). O erro exato fica em Administração → Lembretes SMS.',
  })
}

// Resolve o alerta de gateway offline ainda aberto deste estúdio —
// espelha a faixa a desaparecer sozinha quando recupera.
async function resolverAlertaGatewayOffline(admin: SupabaseClient, estudioId: number) {
  await admin
    .from('alerts')
    .update({ estado: 'Resolvido', resolvido_em: new Date().toISOString(), atualizado_em: new Date().toISOString() })
    .eq('regra_chave', REGRA_GATEWAY_OFFLINE)
    .eq('estudio_id', estudioId)
    .neq('estado', 'Resolvido')
}

// Chamado depois de um envio bem sucedido — repõe o estado a zero e
// resolve o alerta, se havia uma crise em curso. Devolve o estado
// atualizado (ou o mesmo, se não havia nada para repor).
export async function registarSucessoGateway(
  admin: SupabaseClient,
  estudio: Pick<Estudio, 'id'>,
  estadoAtual: EstadoSmsGateway
): Promise<EstadoSmsGateway> {
  if (estadoAtual.tentativas_falhadas === 0) return estadoAtual

  if (estadoAtual.alerta_registado_em) {
    await resolverAlertaGatewayOffline(admin, estudio.id)
  }
  const { data } = await admin
    .from('estado_sms_gateway')
    .update({
      tentativas_falhadas: 0,
      ultima_falha_em: null,
      offline_desde: null,
      alerta_registado_em: null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('estudio_id', estudio.id)
    .select()
    .single()
  return (data ?? estadoAtual) as EstadoSmsGateway
}

// Chamado depois de uma falha de ligação (offline/configuração) —
// incrementa o contador e, ao atingir o limiar, regista o alerta.
// Devolve o estado atualizado.
export async function registarFalhaGateway(
  admin: SupabaseClient,
  estudio: Pick<Estudio, 'id' | 'nome'>,
  estadoAtual: EstadoSmsGateway,
  falha: { origem: 'lembretes' | 'aniversarios'; mensagem: string }
): Promise<EstadoSmsGateway> {
  const novasTentativas = estadoAtual.tentativas_falhadas + 1
  const agoraISO = new Date().toISOString()
  const mensagem = falha.mensagem.slice(0, 500)

  // Fica o registo de cada falha, com o erro exato — para se saber a
  // causa mais tarde (os registos da Vercel só duram 1 hora).
  await admin.from('sms_gateway_falhas').insert({ estudio_id: estudio.id, origem: falha.origem, mensagem })

  const { data: atualizado } = await admin
    .from('estado_sms_gateway')
    .update({
      tentativas_falhadas: novasTentativas,
      ultima_falha_em: agoraISO,
      ultimo_erro: mensagem,
      offline_desde: estadoAtual.offline_desde ?? agoraISO,
      atualizado_em: agoraISO,
    })
    .eq('estudio_id', estudio.id)
    .select()
    .single()
  let estado = (atualizado ?? estadoAtual) as EstadoSmsGateway

  if (novasTentativas >= LIMIAR_CRISE && !estado.alerta_registado_em) {
    await registarAlertaGatewayOffline(admin, estudio)
    const { data: atualizadoAlerta } = await admin
      .from('estado_sms_gateway')
      .update({ alerta_registado_em: new Date().toISOString() })
      .eq('estudio_id', estudio.id)
      .select()
      .single()
    if (atualizadoAlerta) estado = atualizadoAlerta as EstadoSmsGateway
  }

  return estado
}
