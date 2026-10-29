'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function numeroOuNull(formData: FormData, nome: string) {
  const v = campoOuNull(formData, nome)
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function camposComuns(formData: FormData) {
  return {
    nome: formData.get('nome') as string,
    telefone: campoOuNull(formData, 'telefone'),
    email: campoOuNull(formData, 'email'),
    origem: campoOuNull(formData, 'origem'),
    campanha: campoOuNull(formData, 'campanha'),
    modalidade_interesse: campoOuNull(formData, 'modalidade_interesse'),
    temperatura: campoOuNull(formData, 'temperatura') ?? 'Morna',
    walk_in: formData.get('walk_in') === 'on',
    objetivo: campoOuNull(formData, 'objetivo'),
    interesse: campoOuNull(formData, 'interesse'),
    disponibilidade: campoOuNull(formData, 'disponibilidade'),
    responsavel_id: campoOuNull(formData, 'responsavel_id'),
    proximo_contacto: campoOuNull(formData, 'proximo_contacto'),
    valor_potencial: numeroOuNull(formData, 'valor_potencial'),
    nota: campoOuNull(formData, 'nota'),
  }
}

export async function criarLead(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('leads')
    .insert({ ...camposComuns(formData), estudio_id: estudioId })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/painel/${estudioSlug}/leads/novo?error=${encodeURIComponent(error?.message ?? 'Não foi possível criar o lead.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/leads`)
  redirect(`/painel/${estudioSlug}/leads/${data.id}`)
}

export async function atualizarLead(formData: FormData) {
  const id = formData.get('id') as string
  const estudioSlug = formData.get('estudio_slug') as string
  const estado = formData.get('estado') as string
  const visitaData = campoOuNull(formData, 'visita_data')
  const visitaMarcadaAtual = campoOuNull(formData, 'visita_marcada_em_atual')
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  const { error } = await supabase
    .from('leads')
    .update({
      ...camposComuns(formData),
      estado,
      visita_data: visitaData,
      visita_hora: campoOuNull(formData, 'visita_hora'),
      // A data em que a visita foi marcada só se define uma vez — se já
      // existia, mantém-se; só muda quando a visita é marcada agora.
      visita_marcada_em: visitaData ? (visitaMarcadaAtual ?? hoje) : null,
      motivo_perda: estado === 'Perdida' ? campoOuNull(formData, 'motivo_perda') : null,
      fecho_em: estado === 'Perdida' ? hoje : null,
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/leads/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/leads`)
  revalidatePath(`/painel/${estudioSlug}/leads/${id}`)
  redirect(`/painel/${estudioSlug}/leads/${id}`)
}

export type ResultadoAcaoRapida = { ok: true } | { error: string }

// Usado pelo Kanban de arrastar-e-largar. Nunca aceita o estado "Ganha" —
// essa etapa exige sempre criar o cliente (converterEmCliente), por isso
// o quadro trata a coluna "Ganha" como só-leitura e esta ação rejeita-a
// na mesma por segurança caso chegue aqui por outra via.
export async function moverEstadoLeadRapido(input: {
  estudioSlug: string
  id: string
  estado: string
}): Promise<ResultadoAcaoRapida> {
  if (input.estado === 'Ganha') return { error: 'Usa "Converter em cliente" para fechar esta etapa.' }

  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  const { error } = await supabase
    .from('leads')
    .update({
      estado: input.estado,
      fecho_em: input.estado === 'Perdida' ? hoje : null,
    })
    .eq('id', input.id)

  if (error) return { error: error.message }

  revalidatePath(`/painel/${input.estudioSlug}/leads`)
  return { ok: true }
}

// "Agendar experimental" junta duas coisas que até aqui existiam
// separadas: marca a visita na própria lead (como o resto do fluxo já
// fazia) e cria também o evento correspondente na Agenda interna, para
// não ter de repetir a marcação em dois sítios. Sem cliente_id — a
// lead só passa a cliente ao ser convertida.
export async function agendarExperimental(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const leadId = formData.get('lead_id') as string
  const nomeLead = formData.get('nome_lead') as string
  const data = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const hoje = new Date().toISOString().slice(0, 10)

  const sessao = await getSessaoAtual()
  const supabase = await createClient()

  const { error: erroAgenda } = await supabase.from('agenda_eventos').insert({
    estudio_id: estudioId,
    tipo: 'Avaliação',
    titulo: `Experimental — ${nomeLead}`,
    data,
    hora_inicio: horaInicio,
    duracao_min: 40,
    nota: `Lead: ${nomeLead}`,
    criado_por: sessao.userId,
  })

  if (erroAgenda) {
    redirect(`/painel/${estudioSlug}/leads/${leadId}?error=${encodeURIComponent(erroAgenda.message)}`)
  }

  const { error: erroLead } = await supabase
    .from('leads')
    .update({
      visita_data: data,
      visita_hora: horaInicio,
      visita_marcada_em: hoje,
      estado: 'Experimental agendada',
    })
    .eq('id', leadId)

  if (erroLead) {
    redirect(`/painel/${estudioSlug}/leads/${leadId}?error=${encodeURIComponent(erroLead.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/leads`)
  revalidatePath(`/painel/${estudioSlug}/leads/${leadId}`)
  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`/painel/${estudioSlug}/leads/${leadId}`)
}

export async function adicionarContacto(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const leadId = formData.get('lead_id') as string
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('lead_contactos').insert({
    lead_id: leadId,
    data: (formData.get('data') as string) || new Date().toISOString().slice(0, 10),
    tipo: formData.get('tipo') as string,
    resultado: formData.get('resultado') as string,
    nota: campoOuNull(formData, 'nota'),
    feito_por: userData.user?.id ?? null,
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/leads/${leadId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/leads/${leadId}`)
  redirect(`/painel/${estudioSlug}/leads/${leadId}`)
}

export async function converterEmCliente(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const leadId = formData.get('lead_id') as string
  const nome = formData.get('nome') as string
  const telefone = campoOuNull(formData, 'telefone')
  const email = campoOuNull(formData, 'email')
  const objetivo = campoOuNull(formData, 'objetivo')
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .insert({ estudio_id: estudioId, nome, telefone, email, objetivo })
    .select('id')
    .single()

  if (erroCliente || !cliente) {
    redirect(
      `/painel/${estudioSlug}/leads/${leadId}?error=${encodeURIComponent(erroCliente?.message ?? 'Não foi possível criar o cliente.')}`
    )
  }

  const { error: erroLead } = await supabase
    .from('leads')
    .update({ estado: 'Ganha', cliente_id: cliente.id, fecho_em: hoje })
    .eq('id', leadId)

  if (erroLead) {
    redirect(`/painel/${estudioSlug}/leads/${leadId}?error=${encodeURIComponent(erroLead.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/leads`)
  revalidatePath(`/painel/${estudioSlug}/leads/${leadId}`)
  redirect(`/painel/${estudioSlug}/treinos/${cliente.id}`)
}
