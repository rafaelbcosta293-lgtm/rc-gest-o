'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
      motivo_perda: estado === 'Perdido' ? campoOuNull(formData, 'motivo_perda') : null,
      fecho_em: estado === 'Perdido' ? hoje : null,
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/leads/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/leads`)
  revalidatePath(`/painel/${estudioSlug}/leads/${id}`)
  redirect(`/painel/${estudioSlug}/leads/${id}`)
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
    .update({ estado: 'Convertido', cliente_id: cliente.id, fecho_em: hoje })
    .eq('id', leadId)

  if (erroLead) {
    redirect(`/painel/${estudioSlug}/leads/${leadId}?error=${encodeURIComponent(erroLead.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/leads`)
  revalidatePath(`/painel/${estudioSlug}/leads/${leadId}`)
  redirect(`/painel/${estudioSlug}/treinos/${cliente.id}`)
}
