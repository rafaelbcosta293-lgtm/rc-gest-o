import type { SupabaseClient } from '@supabase/supabase-js'
import { somarDias } from './horarios'
import { enviarSms } from '@/lib/sms/gateway'
import { enviarEmailAlerta } from '@/lib/email/resend'
import type { EstadoSmsGateway } from '@/lib/supabase/database.types'

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

export type ResultadoProcessamentoLembretes = {
  enviados: number
  falhasPorNumero: number
  pendentesRestantes: number
  gatewayOffline: boolean
}

// Partilhada pelo cron diário e pelo botão "Tentar Reenvio de
// Lembretes Pendentes" — o telemóvel estar offline pára o processamento
// (não vale a pena insistir cliente a cliente contra um gateway em
// baixo), mas um número inválido só falha esse envio e continua para os
// restantes. As contagens de falhas/alerta vivem em "estado_sms_gateway"
// para sobreviverem entre chamadas (cron em dias diferentes, ou várias
// tentativas da mesma manhã).
export async function processarLembretesSms(
  admin: SupabaseClient
): Promise<ResultadoProcessamentoLembretes> {
  const amanha = dataDeAmanhaEmLisboa()

  const [
    { data: eventosData, error: erroEventos },
    { data: configData, error: erroConfig },
    { data: estadoData, error: erroEstado },
  ] = await Promise.all([
    admin
      .from('agenda_eventos')
      .select('id, data, hora_inicio, cliente:clientes(nome, telefone)')
      .eq('tipo', 'Treino')
      .eq('estado', 'Agendado')
      .eq('data', amanha)
      .eq('lembrete_enviado', false)
      .not('cliente_id', 'is', null),
    admin.from('config').select('valor').eq('chave', 'msg_lembrete_treino').maybeSingle(),
    admin.from('estado_sms_gateway').select('*').eq('id', 1).single(),
  ])

  if (erroEventos) throw new Error(erroEventos.message)
  if (erroConfig) throw new Error(erroConfig.message)
  if (erroEstado) throw new Error(erroEstado.message)

  const template = configData?.valor || TEMPLATE_LEMBRETE_OMISSAO
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
    const resultado = await enviarSms(evento.cliente!.telefone ?? '', texto)

    if (resultado.ok) {
      await admin
        .from('agenda_eventos')
        .update({ lembrete_enviado: true, lembrete_enviado_em: new Date().toISOString() })
        .eq('id', evento.id)
      enviados++

      if (estado.tentativas_falhadas > 0) {
        const { data: atualizado } = await admin
          .from('estado_sms_gateway')
          .update({
            tentativas_falhadas: 0,
            ultima_falha_em: null,
            alerta_enviado_em: null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', 1)
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
        .update({ tentativas_falhadas: novasTentativas, ultima_falha_em: agoraISO, atualizado_em: agoraISO })
        .eq('id', 1)
        .select()
        .single()
      if (atualizado) estado = atualizado as EstadoSmsGateway

      if (novasTentativas >= 3 && !estado.alerta_enviado_em) {
        const restantes = pendentes.length - enviados
        await enviarEmailAlerta(
          '[ALERTA] Telemóvel do SMS Gateway Desligado / Offline',
          `O envio de lembretes de treino por SMS falhou ${novasTentativas} vezes consecutivas.\n\n` +
            `Hora da última falha: ${new Date(agoraISO).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}\n` +
            `Lembretes pendentes por enviar: ${restantes}\n\n` +
            'Verifica se o telemóvel com o SMS Gate está ligado, com bateria e com rede, e depois usa o botão ' +
            '"Tentar Reenvio de Lembretes Pendentes" no painel de Administração → Lembretes SMS.'
        )
        const { data: atualizadoAlerta } = await admin
          .from('estado_sms_gateway')
          .update({ alerta_enviado_em: new Date().toISOString() })
          .eq('id', 1)
          .select()
          .single()
        if (atualizadoAlerta) estado = atualizadoAlerta as EstadoSmsGateway
      }

      console.error(`Lembretes SMS: gateway offline (${resultado.mensagem})`)
      break
    }

    falhasPorNumero++
    console.error(`Lembrete SMS não enviado para o evento ${evento.id}: ${resultado.mensagem}`)
  }

  return {
    enviados,
    falhasPorNumero,
    pendentesRestantes: pendentes.length - enviados,
    gatewayOffline,
  }
}
