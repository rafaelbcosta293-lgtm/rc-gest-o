import type { SupabaseClient } from '@supabase/supabase-js'
import { somarDias } from './horarios'
import { getEstudios } from './estudios'
import { obterEstadoGateway, registarFalhaGateway, registarSucessoGateway } from './smsGateway'
import { enviarSms } from '@/lib/sms/gateway'
import type { Estudio } from '@/lib/supabase/database.types'
import type { ResultadoEstudio } from './smsGateway'

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
  porEstudio: ResultadoEstudio[]
  // true se o gateway de ALGUM estúdio ficou offline nesta execução —
  // é o que o workflow usa para decidir se vale a pena tentar de novo.
  gatewayOffline: boolean
}

async function obterTemplate(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from('config').select('valor').eq('chave', 'msg_lembrete_treino').maybeSingle()
  if (error) throw new Error(error.message)
  return data?.valor || TEMPLATE_LEMBRETE_OMISSAO
}

// Processa um único estúdio — cada um tem o seu próprio telemóvel/
// gateway (ver lib/sms/gateway.ts) e o seu próprio estado_sms_gateway
// (partilhado com os parabéns de aniversário — ver lib/data/smsGateway.ts),
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
  const [{ data: eventosData, error: erroEventos }, estadoInicial] = await Promise.all([
    admin
      .from('agenda_eventos')
      .select('id, data, hora_inicio, cliente:clientes(nome, telefone)')
      .eq('estudio_id', estudio.id)
      .eq('tipo', 'Treino')
      .eq('estado', 'Agendado')
      .eq('data', amanha)
      .eq('lembrete_enviado', false)
      .not('cliente_id', 'is', null),
    obterEstadoGateway(admin, estudio.id),
  ])

  if (erroEventos) throw new Error(erroEventos.message)

  let estado = estadoInicial
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
      estado = await registarSucessoGateway(admin, estudio, estado)
      continue
    }

    if (resultado.tipo === 'offline' || resultado.tipo === 'configuracao') {
      gatewayOffline = true
      estado = await registarFalhaGateway(admin, estudio, estado)
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
// de cada vez — ver processarLembretesSmsDoEstudio).
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
