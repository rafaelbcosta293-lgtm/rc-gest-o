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

// massa_gorda_kg, massa_magra_kg e imc não entram aqui: são colunas
// calculadas automaticamente pela base de dados a partir do peso, da
// altura e da massa gorda (%) — enviar um valor para elas dá erro.
function camposComuns(formData: FormData) {
  return {
    data: formData.get('data') as string,
    pt_id: campoOuNull(formData, 'pt_id'),
    peso_kg: numeroOuNull(formData, 'peso_kg'),
    altura_cm: numeroOuNull(formData, 'altura_cm'),
    massa_gorda_pct: numeroOuNull(formData, 'massa_gorda_pct'),
    massa_muscular_kg: numeroOuNull(formData, 'massa_muscular_kg'),
    gordura_visceral: numeroOuNull(formData, 'gordura_visceral'),
    hidratacao_pct: numeroOuNull(formData, 'hidratacao_pct'),
    metabolismo_kcal: numeroOuNull(formData, 'metabolismo_kcal'),
    proxima_reavaliacao: campoOuNull(formData, 'proxima_reavaliacao'),
    nota: campoOuNull(formData, 'nota'),
  }
}

export async function criarAvaliacao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('avaliacoes')
    .insert({ ...camposComuns(formData), cliente_id: clienteId })

  if (error) {
    redirect(
      `/painel/${estudioSlug}/avaliacoes/${clienteId}/nova?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/avaliacoes`)
  revalidatePath(`/painel/${estudioSlug}/avaliacoes/${clienteId}`)
  redirect(`/painel/${estudioSlug}/avaliacoes/${clienteId}`)
}

export async function atualizarAvaliacao(formData: FormData) {
  const id = formData.get('id') as string
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('avaliacoes').update(camposComuns(formData)).eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/avaliacoes/${clienteId}/${id}/editar?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/avaliacoes`)
  revalidatePath(`/painel/${estudioSlug}/avaliacoes/${clienteId}`)
  redirect(`/painel/${estudioSlug}/avaliacoes/${clienteId}`)
}

export async function apagarAvaliacao(formData: FormData) {
  const id = formData.get('id') as string
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('avaliacoes').delete().eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/avaliacoes/${clienteId}?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/avaliacoes`)
  revalidatePath(`/painel/${estudioSlug}/avaliacoes/${clienteId}`)
  redirect(`/painel/${estudioSlug}/avaliacoes/${clienteId}`)
}
