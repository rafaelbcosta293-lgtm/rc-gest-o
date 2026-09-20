'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CorreuTipo } from '@/lib/data/constantes'
import type { ExercicioSessao } from '@/lib/supabase/database.types'

function lerExercicios(formData: FormData): ExercicioSessao[] {
  const raw = formData.get('exercicios')
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e) => e && typeof e === 'object' && typeof e.nome === 'string' && e.nome.trim() !== ''
    )
  } catch {
    return []
  }
}

export async function criarSessao(formData: FormData) {
  const estudio = formData.get('estudio') as string
  const clienteId = formData.get('cliente_id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('sessoes').insert({
    cliente_id: clienteId,
    data: formData.get('data') as string,
    pt: (formData.get('pt') as string) || null,
    foco: (formData.get('foco') as string) || null,
    correu: (formData.get('correu') as CorreuTipo) || null,
    exercicios: lerExercicios(formData),
    nota_proxima: (formData.get('nota_proxima') as string) || null,
    tipo_nota: (formData.get('tipo_nota') as string) || null,
  })

  if (error) {
    redirect(
      `/painel/${estudio}/treinos/${clienteId}/treino/novo?error=${encodeURIComponent('Não foi possível guardar o treino.')}`
    )
  }

  revalidatePath(`/painel/${estudio}/treinos/${clienteId}`)
  redirect(`/painel/${estudio}/treinos/${clienteId}`)
}

export async function atualizarSessao(formData: FormData) {
  const estudio = formData.get('estudio') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('sessoes')
    .update({
      data: formData.get('data') as string,
      pt: (formData.get('pt') as string) || null,
      foco: (formData.get('foco') as string) || null,
      correu: (formData.get('correu') as CorreuTipo) || null,
      exercicios: lerExercicios(formData),
      nota_proxima: (formData.get('nota_proxima') as string) || null,
      tipo_nota: (formData.get('tipo_nota') as string) || null,
    })
    .eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudio}/treinos/${clienteId}/treino/${id}?error=${encodeURIComponent('Não foi possível guardar as alterações.')}`
    )
  }

  revalidatePath(`/painel/${estudio}/treinos/${clienteId}`)
  redirect(`/painel/${estudio}/treinos/${clienteId}`)
}
