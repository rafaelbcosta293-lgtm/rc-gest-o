import type { SupabaseClient } from '@supabase/supabase-js'
import { getEstudios } from './estudios'
import { preencherMensagem } from './aniversarios'
import { obterEstadoGateway, registarFalhaGateway, registarSucessoGateway } from './smsGateway'
import { enviarSms } from '@/lib/sms/gateway'
import type { Estudio } from '@/lib/supabase/database.types'
import type { ResultadoEstudio } from './smsGateway'

// "Hoje" visto de Lisboa — o cron corre à hora local de Lisboa, mas o
// relógio do servidor está em UTC, por isso o dia de calendário pode
// divergir perto da meia-noite se não se converter explicitamente.
export function dataDeHojeEmLisboa(agora: Date = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
}

type ClienteComAniversarioHoje = {
  id: string
  nome: string
  telefone: string | null
  estado: string
  genero: 'Masculino' | 'Feminino' | null
}

async function obterTemplates(admin: SupabaseClient): Promise<{ ativo: string; exCliente: string }> {
  const { data, error } = await admin.from('config').select('chave, valor').in('chave', ['msg_aniversario', 'msg_aniversario_ex'])
  if (error) throw new Error(error.message)
  const ativo = data?.find((c) => c.chave === 'msg_aniversario')?.valor ?? ''
  const exCliente = data?.find((c) => c.chave === 'msg_aniversario_ex')?.valor ?? ''
  return { ativo, exCliente }
}

// Processa um único estúdio — mesmo gateway e mesmo estado_sms_gateway
// partilhados com os lembretes de treino (ver lib/data/smsGateway.ts e
// lib/data/lembretesSms.ts): uma falha de ligação aqui também conta
// para a mesma "crise" por estúdio, e vice-versa.
async function processarAniversariosDoEstudio(
  admin: SupabaseClient,
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>,
  hoje: string,
  templates: { ativo: string; exCliente: string }
): Promise<ResultadoEstudio> {
  const ano = Number(hoje.slice(0, 4))
  const mesDia = hoje.slice(5, 10)

  const [{ data: clientesData, error: erroClientes }, estadoInicial] = await Promise.all([
    admin
      .from('clientes')
      .select('id, nome, telefone, estado, genero, nascimento')
      .eq('estudio_id', estudio.id)
      .not('nascimento', 'is', null),
    obterEstadoGateway(admin, estudio.id),
  ])
  if (erroClientes) throw new Error(erroClientes.message)

  const aniversariantes = (
    (clientesData ?? []) as (ClienteComAniversarioHoje & { nascimento: string })[]
  ).filter((c) => c.nascimento.slice(5, 10) === mesDia)

  if (aniversariantes.length === 0) {
    return {
      estudioSlug: estudio.slug,
      estudioNome: estudio.nome,
      enviados: 0,
      falhasPorNumero: 0,
      pendentesRestantes: 0,
      gatewayOffline: false,
    }
  }

  const { data: enviosData, error: erroEnvios } = await admin
    .from('envios_aniversario')
    .select('cliente_id')
    .eq('ano', ano)
    .in(
      'cliente_id',
      aniversariantes.map((c) => c.id)
    )
  if (erroEnvios) throw new Error(erroEnvios.message)
  const jaEnviados = new Set((enviosData ?? []).map((e) => e.cliente_id))
  const pendentes = aniversariantes.filter((c) => !jaEnviados.has(c.id))

  let estado = estadoInicial
  let enviados = 0
  let falhasPorNumero = 0
  let gatewayOffline = false

  for (const cliente of pendentes) {
    const template = cliente.estado === 'Ex-cliente' ? templates.exCliente : templates.ativo
    if (!template) {
      falhasPorNumero++
      console.error(`Parabéns SMS: sem modelo de mensagem configurado para "${cliente.estado}" (${estudio.slug}).`)
      continue
    }

    const texto = preencherMensagem(template, cliente.nome, cliente.genero)
    const resultado = await enviarSms(estudio.slug, cliente.telefone ?? '', texto)

    if (resultado.ok) {
      await admin.from('envios_aniversario').insert({ cliente_id: cliente.id, ano })
      enviados++
      estado = await registarSucessoGateway(admin, estudio, estado)
      continue
    }

    if (resultado.tipo === 'offline' || resultado.tipo === 'configuracao') {
      gatewayOffline = true
      estado = await registarFalhaGateway(admin, estudio, estado)
      console.error(`Parabéns SMS (${estudio.slug}): gateway offline (${resultado.mensagem})`)
      break
    }

    falhasPorNumero++
    console.error(`Parabéns SMS não enviados ao cliente ${cliente.id} (${estudio.slug}): ${resultado.mensagem}`)
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

export type ResultadoProcessamentoAniversarios = {
  porEstudio: ResultadoEstudio[]
  gatewayOffline: boolean
}

// Partilhada pelo cron diário (processa todos os estúdios) e pelo
// botão de reenvio manual em Clientes → Aniversários (um estúdio de
// cada vez — ver processarAniversariosSmsDoEstudio). A exclusão de
// duplicados usa a mesma tabela "envios_aniversario" (única por
// cliente+ano) já usada pela marcação manual de "enviado".
export async function processarAniversariosSms(admin: SupabaseClient): Promise<ResultadoProcessamentoAniversarios> {
  const hoje = dataDeHojeEmLisboa()
  const [estudios, templates] = await Promise.all([getEstudios(admin), obterTemplates(admin)])

  const porEstudio: ResultadoEstudio[] = []
  for (const estudio of estudios) {
    porEstudio.push(await processarAniversariosDoEstudio(admin, estudio, hoje, templates))
  }

  return { porEstudio, gatewayOffline: porEstudio.some((r) => r.gatewayOffline) }
}

export async function processarAniversariosSmsDoEstudio(
  admin: SupabaseClient,
  estudioSlug: string
): Promise<ResultadoEstudio> {
  const estudios = await getEstudios(admin)
  const estudio = estudios.find((e) => e.slug === estudioSlug)
  if (!estudio) throw new Error(`Estúdio "${estudioSlug}" não encontrado.`)

  const hoje = dataDeHojeEmLisboa()
  const templates = await obterTemplates(admin)
  return processarAniversariosDoEstudio(admin, estudio, hoje, templates)
}
