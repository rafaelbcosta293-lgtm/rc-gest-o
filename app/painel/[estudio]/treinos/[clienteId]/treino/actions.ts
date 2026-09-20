'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type LinhaParaGravar = {
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

function lerExercicios(formData: FormData): LinhaParaGravar[] {
  const raw = formData.get('exercicios')
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e) =>
        e &&
        typeof e === 'object' &&
        typeof e.exercicio_nome === 'string' &&
        e.exercicio_nome.trim() !== ''
    )
  } catch {
    return []
  }
}

export async function criarSessao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const clienteId = formData.get('cliente_id') as string
  const supabase = await createClient()

  const { data: sessao, error } = await supabase
    .from('sessoes')
    .insert({
      cliente_id: clienteId,
      estudio_id: estudioId,
      data: formData.get('data') as string,
      pt_id: (formData.get('pt_id') as string) || null,
      foco: (formData.get('foco') as string) || null,
      correu: (formData.get('correu') as string) || null,
      nota_proxima: formData.get('nota_proxima') as string,
      tipo_nota: (formData.get('tipo_nota') as string) || null,
    })
    .select('id')
    .single()

  if (error || !sessao) {
    redirect(
      `/painel/${estudioSlug}/treinos/${clienteId}/treino/novo?error=${encodeURIComponent('Não foi possível guardar o treino.')}`
    )
  }

  const linhas = lerExercicios(formData)
  if (linhas.length > 0) {
    await supabase.from('sessao_exercicios').insert(
      linhas.map((l) => ({
        sessao_id: sessao.id,
        ordem: l.ordem,
        bloco: l.bloco,
        exercicio_id: l.exercicio_id,
        exercicio_nome: l.exercicio_nome,
        series: l.series || null,
        reps: l.reps || null,
        carga: l.carga || null,
        descanso: l.descanso || null,
        nota: l.nota || null,
      }))
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}`)
}

export async function atualizarSessao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('sessoes')
    .update({
      data: formData.get('data') as string,
      pt_id: (formData.get('pt_id') as string) || null,
      foco: (formData.get('foco') as string) || null,
      correu: (formData.get('correu') as string) || null,
      nota_proxima: formData.get('nota_proxima') as string,
      tipo_nota: (formData.get('tipo_nota') as string) || null,
    })
    .eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/treinos/${clienteId}/treino/${id}?error=${encodeURIComponent('Não foi possível guardar as alterações.')}`
    )
  }

  await supabase.from('sessao_exercicios').delete().eq('sessao_id', id)

  const linhas = lerExercicios(formData)
  if (linhas.length > 0) {
    await supabase.from('sessao_exercicios').insert(
      linhas.map((l) => ({
        sessao_id: id,
        ordem: l.ordem,
        bloco: l.bloco,
        exercicio_id: l.exercicio_id,
        exercicio_nome: l.exercicio_nome,
        series: l.series || null,
        reps: l.reps || null,
        carga: l.carga || null,
        descanso: l.descanso || null,
        nota: l.nota || null,
      }))
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}`)
}
