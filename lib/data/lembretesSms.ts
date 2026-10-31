import type { SupabaseClient } from '@supabase/supabase-js'
import { somarDias } from './horarios'
import { getEstudios } from './estudios'
import { enviarSms } from '@/lib/sms/gateway'
import type { Estudio, EstadoSmsGateway } from '@/lib/supabase/database.types'

// A partir de quantas falhas consecutivas se considera "offline" a
// sério (não só um soluço passageiro de rede) — é o mesmo limiar que
// decide quando a faixa vermelha e o alerta em Administração aparecem.
const LIMIAR_CRISE = 3
const REGRA_GATEWAY_OFFLINE = 'sms_gateway_offline'

export const TEMPLATE_LEMBRETE_OMISSAO =
  'Olá {nome}! Lembramos que o teu treino é {dia_semana}, dia {dia_mes}, às {hora}. Contamos contigo! Com os melhores cumprimentos, Equipa RC Private Fitness Studio'

export const VARIAVEIS_TEMPLATE_LEMBRETE = [
  { variavel: '{nome}', descricao: 'Nome do cliente' },
  { variavel: '{dia_semana}', descricao: 'Dia da semana por extenso (ex: terça-feira)' },
  { variavel: '{dia_mes}', descricao: 'Dia do mês (ex: 10)' },
  { variavel: '{hora}', descricao: 'Hora de início do treino (ex: 10:00)' },
] as const

const NOMES_DIA_SEMANA = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
]

export function nomeDiaSemana(dataISO: string): string {
  const diaSemanaJs = new Date(`${dataISO}T00:00:00Z`).getUTCDay() // 0=Dom…6=Sáb
  const indice = (diaSemanaJs + 6) % 7 // 0=Seg…6=Dom
  return NOMES_DIA_SEMANA[indice]
}

export function preencherTemplateLembrete(
  template: string,
  dados: { nome: string; data: string; horaInicio: string }
): string {
  const diaMes = Number(dados.data.slice(8, 10))
  const hora = dados.horaInicio.slice(0, 5)
  return template
    .replaceAll('{nome}', dados.nome)
    .replaceAll('{dia_semana}', nomeDiaSemana(dados.data))
    .replaceAll('{dia_mes}', String(diaMes))
    .replaceAll('{hora}', hora)
}

// "Amanhã" visto de Lisboa — o cron corre à hora local de Lisboa, mas o
// relógio do servidor está em UTC, por isso o dia de calendário pode
// divergir perto da meia-noite se não se converter explicitamente.
export function dataDeAmanhaEmLisboa(agora: Date = new Date()): string {
  const hojeLisboa = agora.toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
  return somarDias(hojeLisboa, 1)
}

type EventoComCliente = {
  id: string
  data: string
  hora_inicio: string
  cliente: { nome: string; telefone: string | null } | null
}

export type ResultadoEstudio = {
  estudioSlug: string
  estudioNome: string
  enviados: number
  falhasPorNumero: number
  pendentesRestantes: number
  gatewayOffline: boolean
}

export type ResultadoProcessamentoLembretes = {
  porEstudio: ResultadoEstudio[]
  // true se o gateway de ALGUM estúdio ficou offline nesta execução —
  // é o que o workflow usa para decidir se vale a pena tentar de novo.
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

// Cria um alerta "Crítico" (visível em Centro de alertas, só para
// gestão) para este estúdio. Idempotente: só é chamada uma vez por
// "crise" (ver alerta_registado_em em processarLembretesDoEstudio).
async function registarAlertaGatewayOffline(admin: SupabaseClient, estudio: Pick<Estudio, 'id' | 'nome'>) {
  await admin.from('alerts').insert({
    estudio_id: estudio.id,
    regra_chave: REGRA_GATEWAY_OFFLINE,
    severidade: 'Crítico' as const,
    titulo: `SMS Gateway (${estudio.nome}) offline — os lembretes de treino não estão a ser enviados`,
    descricao:
      `O telemóvel que envia os lembretes de treino por SMS em ${estudio.nome} está inacessível há 3 ` +
      'tentativas consecutivas. Verifica se está ligado, com bateria e com rede, e depois usa ' +
      '"Tentar Reenvio de Lembretes Pendentes" em Administração → Lembretes SMS.',
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

async function obterTemplate(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from('config').select('valor').eq('chave', 'msg_lembrete_treino').maybeSingle()
  if (error) throw new Error(error.message)
  return data?.valor || TEMPLATE_LEMBRETE_OMISSAO
}

// Processa um único estúdio — cada um tem o seu próprio telemóvel/
// gateway (ver lib/sms/gateway.ts) e o seu próprio estado_sms_gateway,
// por isso uma falha em Fátima nunca afeta Leiria (e vice-versa). O
// telemóvel estar offline pára o processamento desse estúdio (não vale
// a pena insistir cliente a cliente contra um gateway em baixo), mas
// um número inválido só falha esse envio e continua para os restantes.
async function processarLembretesDoEstudio(
  admin: SupabaseClient,
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>,
  amanha: string,
  template: string
): Promise<ResultadoEstudio> {
  const [{ data: eventosData, error: erroEventos }, { data: estadoData, error: erroEstado }] = await Promise.all([
    admin
      .from('agenda_eventos')
      .select('id, data, hora_inicio, cliente:clientes(nome, telefone)')
      .eq('estudio_id', estudio.id)
      .eq('tipo', 'Treino')
      .eq('estado', 'Agendado')
      .eq('data', amanha)
      .eq('lembrete_enviado', false)
      .not('cliente_id', 'is', null),
    admin.from('estado_sms_gateway').select('*').eq('estudio_id', estudio.id).single(),
  ])

  if (erroEventos) throw new Error(erroEventos.message)
  if (erroEstado) throw new Error(erroEstado.message)

  let estado = estadoData as EstadoSmsGateway
  const pendentes = ((eventosData ?? []) as unknown as EventoComCliente[]).filter((e) => e.cliente)

  let enviados = 0
  let falhasPorNumero = 0
  let gatewayOffline = false

  for (const evento of pendentes) {
    const texto = preencherTemplateLembrete(template, {
      nome: evento.cliente!.nome,
      data: evento.data,
      horaInicio: evento.hora_inicio,
    })
    const resultado = await enviarSms(estudio.slug, evento.cliente!.telefone ?? '', texto)

    if (resultado.ok) {
      await admin
        .from('agenda_eventos')
        .update({ lembrete_enviado: true, lembrete_enviado_em: new Date().toISOString() })
        .eq('id', evento.id)
      enviados++

      if (estado.tentativas_falhadas > 0) {
        if (estado.alerta_registado_em) {
          await resolverAlertaGatewayOffline(admin, estudio.id)
        }
        const { data: atualizado } = await admin
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
        if (atualizado) estado = atualizado as EstadoSmsGateway
      }
      continue
    }

    if (resultado.tipo === 'offline' || resultado.tipo === 'configuracao') {
      gatewayOffline = true
      const novasTentativas = estado.tentativas_falhadas + 1
      const agoraISO = new Date().toISOString()

      const { data: atualizado } = await admin
        .from('estado_sms_gateway')
        .update({
          tentativas_falhadas: novasTentativas,
          ultima_falha_em: agoraISO,
          offline_desde: estado.offline_desde ?? agoraISO,
          atualizado_em: agoraISO,
        })
        .eq('estudio_id', estudio.id)
        .select()
        .single()
      if (atualizado) estado = atualizado as EstadoSmsGateway

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

      console.error(`Lembretes SMS (${estudio.slug}): gateway offline (${resultado.mensagem})`)
      break
    }

    falhasPorNumero++
    console.error(`Lembrete SMS não enviado para o evento ${evento.id} (${estudio.slug}): ${resultado.mensagem}`)
  }

  return {
    estudioSlug: estudio.slug,
    estudioNome: estudio.nome,
    enviados,
    falhasPorNumero,
    pendentesRestantes: pendentes.length - enviados,
    gatewayOffline,
  }
}

// Partilhada pelo cron diário (processa todos os estúdios) e pelo
// botão "Tentar Reenvio de Lembretes Pendentes" no painel (um estúdio
// de cada vez — ver processarLembretesDoEstudioPorSlug).
export async function processarLembretesSms(admin: SupabaseClient): Promise<ResultadoProcessamentoLembretes> {
  const amanha = dataDeAmanhaEmLisboa()
  const [estudios, template] = await Promise.all([getEstudios(admin), obterTemplate(admin)])

  const porEstudio: ResultadoEstudio[] = []
  for (const estudio of estudios) {
    porEstudio.push(await processarLembretesDoEstudio(admin, estudio, amanha, template))
  }

  return { porEstudio, gatewayOffline: porEstudio.some((r) => r.gatewayOffline) }
}

export async function processarLembretesSmsDoEstudio(
  admin: SupabaseClient,
  estudioSlug: string
): Promise<ResultadoEstudio> {
  const estudios = await getEstudios(admin)
  const estudio = estudios.find((e) => e.slug === estudioSlug)
  if (!estudio) throw new Error(`Estúdio "${estudioSlug}" não encontrado.`)

  const amanha = dataDeAmanhaEmLisboa()
  const template = await obterTemplate(admin)
  return processarLembretesDoEstudio(admin, estudio, amanha, template)
}
