import type { SupabaseClient } from '@supabase/supabase-js'
import { primeiroNomeExibicao } from './clientes'
import { hojeEmLisboa } from './hoje'
import { obterEstadoGateway, registarFalhaGateway, registarSucessoGateway } from './smsGateway'
import { enviarSms, normalizarTelefoneSms } from '@/lib/sms/gateway'

// SMS único a dar a cada cliente o seu nº de cliente, para o check-in no
// tablet à entrada (ver app/checkin). Vai para os clientes ativos e para
// quem tem treinos ou aulas marcados daqui para a frente (mesmo que a
// mensalidade esteja pendente).

export function mensagemNumeroCliente(nome: string, nomePreferido: string | null, numeroSocio: string): string {
  const digitos = numeroSocio.replace(/\D/g, '')
  return (
    `Olá ${primeiroNomeExibicao(nome, nomePreferido)}! Mensagem apenas informativa: o seu nº de cliente no RC Private Fitness Studio é ${numeroSocio}.\n\n` +
    `Vai servir para registar a sua presença quando vier treinar: no tablet à entrada do estúdio, escreva só os números (${digitos}) e carregue em "Registar presença".\n\n` +
    `Com os melhores cumprimentos,\nA equipa RC Private Fitness Studio`
  )
}

export type DestinatarioNumero = {
  id: string
  nome: string
  nome_preferido: string | null
  numero_socio: string | null
  telefone: string | null
  estado: string
  enviado: boolean
}

export async function carregarDestinatariosNumero(supabase: SupabaseClient, estudioId: number): Promise<DestinatarioNumero[]> {
  const hoje = hojeEmLisboa()
  const [clientes, treinos, aulas, enviados] = await Promise.all([
    supabase.from('clientes').select('id, nome, nome_preferido, numero_socio, telefone, estado').eq('estudio_id', estudioId).order('nome'),
    supabase
      .from('agenda_eventos')
      .select('cliente_id')
      .eq('estudio_id', estudioId)
      .eq('tipo', 'Treino')
      .eq('estado', 'Agendado')
      .gte('data', hoje)
      .not('cliente_id', 'is', null)
      .limit(5000),
    supabase.from('aulas_inscricoes').select('cliente_id, aula:aulas!inner(estudio_id, data)').eq('estado', 'Inscrito').eq('aula.estudio_id', estudioId).gte('aula.data', hoje),
    supabase.from('envios_numero_cliente').select('cliente_id'),
  ])
  for (const r of [clientes, treinos, aulas, enviados]) if (r.error) throw new Error(r.error.message)
  const comMarcacao = new Set([
    ...((treinos.data ?? []) as { cliente_id: string }[]).map((t) => t.cliente_id),
    ...((aulas.data ?? []) as { cliente_id: string }[]).map((a) => a.cliente_id),
  ])
  const jaEnviados = new Set(((enviados.data ?? []) as { cliente_id: string }[]).map((e) => e.cliente_id))
  return ((clientes.data ?? []) as Omit<DestinatarioNumero, 'enviado'>[])
    .filter((c) => c.estado === 'Ativo' || comMarcacao.has(c.id))
    .map((c) => ({ ...c, enviado: jaEnviados.has(c.id) }))
}

export const podeReceber = (d: DestinatarioNumero) => !!d.numero_socio && !!normalizarTelefoneSms(d.telefone)

export type ResultadoEnvioNumeros = { enviados: number; falhas: string[]; offline: string | null; porEnviar: number }

// Envia a quem ainda não recebeu. Pára ao primeiro sinal de telemóvel
// offline (os restantes ficam por enviar e o botão pode voltar a ser usado).
export async function enviarNumerosCliente(
  admin: SupabaseClient,
  estudio: { id: number; slug: string; nome: string }
): Promise<ResultadoEnvioNumeros> {
  const todos = await carregarDestinatariosNumero(admin, estudio.id)
  const pendentes = todos.filter((d) => !d.enviado && podeReceber(d))
  let estado = await obterEstadoGateway(admin, estudio.id)
  let enviados = 0
  const falhas: string[] = []
  let offline: string | null = null
  for (const d of pendentes) {
    const r = await enviarSms(estudio.slug, d.telefone!, mensagemNumeroCliente(d.nome, d.nome_preferido, d.numero_socio!))
    if (r.ok) {
      const { error } = await admin.from('envios_numero_cliente').insert({ cliente_id: d.id })
      if (error) console.error('[sms nº cliente] envio não registado:', error.message)
      enviados++
      estado = await registarSucessoGateway(admin, estudio, estado)
      continue
    }
    if (r.tipo === 'offline' || r.tipo === 'configuracao') {
      offline = r.mensagem
      estado = await registarFalhaGateway(admin, estudio, estado, { origem: 'numero_cliente', mensagem: r.mensagem })
      break
    }
    falhas.push(d.nome)
  }
  return { enviados, falhas, offline, porEnviar: pendentes.length - enviados - falhas.length }
}
