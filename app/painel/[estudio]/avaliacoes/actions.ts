'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEquipaDoEstudio, getEstudioPorSlug } from '@/lib/data/estudios'
import { semSair, type ResultadoSemSair } from '@/lib/acoes/semSair'
import type { Avaliacao, Perfil } from '@/lib/supabase/database.types'

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

// error.message sozinho (ex.: "numeric field overflow") não diz qual
// campo — o detalhe do Postgres (ex.: "A field with precision 4, scale
// 1 must round to an absolute value less than 10^3.") é o que permite
// perceber de imediato qual o valor a corrigir.
function mensagemErro(error: { message: string; details?: string | null }) {
  return error.details ? `${error.message} — ${error.details}` : error.message
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
    idade_metabolica: numeroOuNull(formData, 'idade_metabolica'),
    densidade_ossea: numeroOuNull(formData, 'densidade_ossea'),
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
      `/painel/${estudioSlug}/avaliacoes/${clienteId}/nova?error=${encodeURIComponent(mensagemErro(error))}`
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
      `/painel/${estudioSlug}/avaliacoes/${clienteId}/${id}/editar?error=${encodeURIComponent(mensagemErro(error))}`
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

// ── Janela de edição (sem sair da página do cliente) ─────────────────

// Guarda uma avaliação (nova ou existente) a partir da janela — a mesma
// lógica de criarAvaliacao/atualizarAvaliacao, sem mudar de página.
export async function guardarAvaliacaoNaJanela(formData: FormData): Promise<ResultadoSemSair> {
  return semSair(formData.get('id') ? atualizarAvaliacao : criarAvaliacao, formData)
}

export type DadosJanelaAvaliacao = {
  pts: Pick<Perfil, 'id' | 'nome'>[]
  avaliacao: Avaliacao | null
  // A altura da última avaliação (raramente muda): já vem preenchida numa nova.
  alturaSugerida: number | null
}

// O que o formulário de uma avaliação precisa (avaliacaoId null = nova).
export async function dadosDaJanelaAvaliacao(
  estudioSlug: string,
  clienteId: string,
  avaliacaoId: string | null
): Promise<DadosJanelaAvaliacao | { erro: string }> {
  const supabase = await createClient()
  const [estudio, { data: cliente }, { data: avaliacao }, { data: ultima }] = await Promise.all([
    getEstudioPorSlug(supabase, estudioSlug),
    supabase.from('clientes').select('id, estudio_id').eq('id', clienteId).maybeSingle(),
    avaliacaoId
      ? supabase.from('avaliacoes').select('*').eq('id', avaliacaoId).eq('cliente_id', clienteId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('avaliacoes').select('altura_cm').eq('cliente_id', clienteId).order('data', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) return { erro: 'Cliente não encontrado.' }
  if (avaliacaoId && !avaliacao) return { erro: 'Avaliação não encontrada.' }
  const pts = await getEquipaDoEstudio(supabase, estudio.id, (avaliacao as Avaliacao | null)?.pt_id ?? undefined)
  return { pts, avaliacao: (avaliacao as Avaliacao | null) ?? null, alturaSugerida: ultima?.altura_cm ?? null }
}
