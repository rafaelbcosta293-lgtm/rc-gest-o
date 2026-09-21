'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function iniciarChecklist(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const tipo = formData.get('tipo') as string
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { data: itens, error: erroItens } = await supabase
    .from('checklist_modelo')
    .select('secao, item')
    .eq('tipo', tipo)
    .eq('ativo', true)
    .order('ordem')

  if (erroItens) {
    redirect(`/painel/${estudioSlug}/checklist?error=${encodeURIComponent(erroItens.message)}`)
  }

  const { data: registo, error: erroRegisto } = await supabase
    .from('checklist_registos')
    .insert({
      estudio_id: estudioId,
      tipo,
      pt_id: userData.user?.id ?? null,
      total: itens?.length ?? 0,
    })
    .select('id')
    .single()

  if (erroRegisto || !registo) {
    redirect(
      `/painel/${estudioSlug}/checklist?error=${encodeURIComponent(erroRegisto?.message ?? 'Não foi possível iniciar a checklist.')}`
    )
  }

  if (itens && itens.length > 0) {
    const { error: erroRespostas } = await supabase.from('checklist_respostas').insert(
      itens.map((it) => ({ registo_id: registo.id, secao: it.secao, item: it.item }))
    )
    if (erroRespostas) {
      redirect(
        `/painel/${estudioSlug}/checklist?error=${encodeURIComponent(erroRespostas.message)}`
      )
    }
  }

  revalidatePath(`/painel/${estudioSlug}/checklist`)
  redirect(`/painel/${estudioSlug}/checklist/${registo.id}`)
}

export async function alternarItem(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const registoId = formData.get('registo_id') as string
  const respostaId = formData.get('resposta_id') as string
  const ok = formData.get('ok') === 'true'
  const supabase = await createClient()

  const { error: erroResposta } = await supabase
    .from('checklist_respostas')
    .update({ ok })
    .eq('id', respostaId)

  if (erroResposta) {
    redirect(
      `/painel/${estudioSlug}/checklist/${registoId}?error=${encodeURIComponent(erroResposta.message)}`
    )
  }

  const { count, error: erroContagem } = await supabase
    .from('checklist_respostas')
    .select('id', { count: 'exact', head: true })
    .eq('registo_id', registoId)
    .eq('ok', true)

  if (erroContagem) {
    redirect(
      `/painel/${estudioSlug}/checklist/${registoId}?error=${encodeURIComponent(erroContagem.message)}`
    )
  }

  const { error: erroRegisto } = await supabase
    .from('checklist_registos')
    .update({ concluidos: count ?? 0 })
    .eq('id', registoId)

  if (erroRegisto) {
    redirect(
      `/painel/${estudioSlug}/checklist/${registoId}?error=${encodeURIComponent(erroRegisto.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/checklist/${registoId}`)
  revalidatePath(`/painel/${estudioSlug}/checklist`)
  redirect(`/painel/${estudioSlug}/checklist/${registoId}`)
}

// Gestão dos itens do modelo (Abertura/Fecho) — não afeta checklists já
// iniciadas, porque as respostas guardam o texto do item na altura, sem
// ligação direta ao modelo.
export async function criarItemModelo(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const tipo = formData.get('tipo') as string
  const secao = (formData.get('secao') as string)?.trim() || 'Geral'
  const item = (formData.get('item') as string)?.trim()
  const supabase = await createClient()

  if (!item) {
    redirect(`/painel/${estudioSlug}/checklist`)
  }

  const { count } = await supabase
    .from('checklist_modelo')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', tipo)

  const { error } = await supabase.from('checklist_modelo').insert({
    tipo,
    secao,
    item,
    ordem: count ?? 0,
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/checklist?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/checklist`)
  redirect(`/painel/${estudioSlug}/checklist`)
}

export async function atualizarItemModelo(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const secao = (formData.get('secao') as string)?.trim() || 'Geral'
  const item = (formData.get('item') as string)?.trim()
  const supabase = await createClient()

  if (!item) {
    redirect(`/painel/${estudioSlug}/checklist?error=${encodeURIComponent('O item não pode ficar em branco.')}`)
  }

  const { error } = await supabase.from('checklist_modelo').update({ secao, item }).eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/checklist?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/checklist`)
  redirect(`/painel/${estudioSlug}/checklist`)
}

export async function removerItemModelo(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('checklist_modelo').update({ ativo: false }).eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/checklist?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/checklist`)
  redirect(`/painel/${estudioSlug}/checklist`)
}

export async function guardarOcorrencia(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const registoId = formData.get('registo_id') as string
  const ocorrencia = (formData.get('ocorrencia') as string) || null
  const supabase = await createClient()

  const { error } = await supabase
    .from('checklist_registos')
    .update({ ocorrencia })
    .eq('id', registoId)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/checklist/${registoId}?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/checklist/${registoId}`)
  redirect(`/painel/${estudioSlug}/checklist/${registoId}`)
}
