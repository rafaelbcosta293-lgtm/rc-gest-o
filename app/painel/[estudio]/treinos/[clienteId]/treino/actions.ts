'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// As presenças contam só a partir dos eventos da Agenda (ver
// lib/data/agenda.ts e o cron de presenças) — planear ou registar um
// treino aqui nunca cria nem apaga presenças.

const hojeLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())

// "Planear treino": cria a sessão (em branco) e leva logo para o plano.
export async function iniciarTreino(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const clienteId = formData.get('cliente_id') as string
  const ptId = (formData.get('pt_id') as string) || null
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get('data') ?? '')) ? String(formData.get('data')) : hojeLisboa()
  const supabase = await createClient()

  const { data: sessao, error } = await supabase
    .from('sessoes')
    .insert({
      cliente_id: clienteId,
      estudio_id: estudioId,
      data,
      pt_id: ptId,
      nota_proxima: '',
    })
    .select('id')
    .single()

  if (error || !sessao) {
    redirect(
      `/painel/${estudioSlug}/treinos/${clienteId}?error=${encodeURIComponent('Não foi possível iniciar o treino.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}/treino/${sessao.id}`)
}

// ANTES do treino: data, PT e foco (os exercícios já se guardam um a
// um, à medida que se escrevem). Não mexe em "como correu".
export async function guardarPlano(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const dataTreino = formData.get('data') as string
  const ptId = (formData.get('pt_id') as string) || null
  const supabase = await createClient()

  const { error } = await supabase
    .from('sessoes')
    .update({ data: dataTreino, pt_id: ptId, foco: (formData.get('foco') as string) || null })
    .eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/treinos/${clienteId}/treino/${id}?error=${encodeURIComponent('Não foi possível guardar o plano.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}/treino/${id}?ok=plano`)
}

// DEPOIS do treino: como correu, tipo de nota e nota para o próximo.
// Só a partir do dia do treino.
export async function registarTreino(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const correu = (formData.get('correu') as string) || ''
  const voltar = (erro: string): never =>
    redirect(`/painel/${estudioSlug}/treinos/${clienteId}/treino/${id}?error=${encodeURIComponent(erro)}`)
  if (!correu) voltar('Escolhe como correu o treino.')

  const supabase = await createClient()
  const { data: atual } = await supabase.from('sessoes').select('data').eq('id', id).maybeSingle()
  if (!atual) voltar('Treino não encontrado.')
  if (atual!.data > hojeLisboa()) voltar('Este treino ainda não aconteceu — o registo de como correu fica disponível no dia do treino.')

  const { error } = await supabase
    .from('sessoes')
    .update({
      correu,
      tipo_nota: (formData.get('tipo_nota') as string) || 'Normal',
      nota_proxima: (formData.get('nota_proxima') as string) ?? '',
    })
    .eq('id', id)
  if (error) voltar('Não foi possível registar o treino.')

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}`)
}

type LinhaParaGravar = {
  id: string | null
  sessaoId: string
  ordem: number
  bloco: string
  exercicio_id: string | null
  exercicio_nome: string
  series: string
  reps: string
  carga: string
  descanso: string
  nota: string
}

type ResultadoLinha = { id: string } | { error: string }

// Chamado diretamente do formulário de treino (sem <form>/redirect), uma
// linha de cada vez, para o plano ficar sempre atualizado enquanto o PT
// vai avançando no treino em vez de tudo depender de um único "Guardar"
// no fim.
export async function guardarLinhaExercicio(linha: LinhaParaGravar): Promise<ResultadoLinha> {
  const supabase = await createClient()
  const valores = {
    sessao_id: linha.sessaoId,
    ordem: linha.ordem,
    bloco: linha.bloco,
    exercicio_id: linha.exercicio_id,
    exercicio_nome: linha.exercicio_nome,
    series: linha.series || null,
    reps: linha.reps || null,
    carga: linha.carga || null,
    descanso: linha.descanso || null,
    nota: linha.nota || null,
  }

  if (linha.id) {
    const { error } = await supabase.from('sessao_exercicios').update(valores).eq('id', linha.id)
    if (error) return { error: error.message }
    return { id: linha.id }
  }

  const { data, error } = await supabase
    .from('sessao_exercicios')
    .insert(valores)
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Não foi possível guardar o exercício.' }
  return { id: data.id }
}

export async function apagarLinhaExercicio(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('sessao_exercicios').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// Apaga o treino todo (não só uma linha de exercício) — restrito a
// gestão pela RLS (apagar_sessoes). Os exercícios da sessão vão atrás
// (FK em cascade); uma presença ligada a este treino fica sem o
// sessao_id em vez de ser apagada (o cliente esteve mesmo presente).
export async function apagarSessao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('sessoes').delete().eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/treinos/${clienteId}?error=${encodeURIComponent('Não foi possível eliminar o treino.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/presencas/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}`)
}
