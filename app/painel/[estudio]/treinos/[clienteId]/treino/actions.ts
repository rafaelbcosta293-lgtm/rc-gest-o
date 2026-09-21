'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function marcarPresencaDoTreino(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessaoId: string,
  clienteId: string,
  data: string,
  ptId: string | null
) {
  // Um treino registado conta sempre como presença. Remove qualquer
  // registo anterior ligado a este treino (caso a data tenha mudado)
  // e qualquer registo manual já existente nesse novo dia, para nunca
  // haver mais do que uma presença por cliente e por dia.
  await supabase.from('presencas').delete().eq('sessao_id', sessaoId)
  await supabase.from('presencas').delete().match({ cliente_id: clienteId, data })
  await supabase.from('presencas').insert({
    cliente_id: clienteId,
    data,
    estado: 'Presente',
    pt_id: ptId,
    sessao_id: sessaoId,
  })
}

// Cria já a sessão (em branco) e leva logo para a ficha de edição — para
// o PT poder ir registando cada exercício em tempo real, durante o
// treino, sem ter de preencher tudo antes de gravar nada pela primeira
// vez.
export async function iniciarTreino(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const clienteId = formData.get('cliente_id') as string
  const ptId = (formData.get('pt_id') as string) || null
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  const { data: sessao, error } = await supabase
    .from('sessoes')
    .insert({
      cliente_id: clienteId,
      estudio_id: estudioId,
      data: hoje,
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

  await marcarPresencaDoTreino(supabase, sessao.id, clienteId, hoje, ptId)

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/presencas/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}/treino/${sessao.id}`)
}

// Só os campos do próprio treino (data, PT, foco, fecho) — os exercícios
// já ficam guardados um a um por guardarLinhaExercicio/apagarLinhaExercicio
// enquanto o PT vai preenchendo o plano.
export async function atualizarSessao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const dataTreino = formData.get('data') as string
  const ptId = (formData.get('pt_id') as string) || null
  const supabase = await createClient()

  const { error } = await supabase
    .from('sessoes')
    .update({
      data: dataTreino,
      pt_id: ptId,
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

  await marcarPresencaDoTreino(supabase, id, clienteId, dataTreino, ptId)

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/presencas/${clienteId}`)
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
