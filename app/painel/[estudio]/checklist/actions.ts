'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { CHECKLIST_PADRAO, itensEmFalta } from '@/lib/data/checklistPadrao'
import type { TipoOperacao } from '@/lib/supabase/database.types'

export async function iniciarChecklist(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const tipo = formData.get('tipo') as string
  // Quem faz a abertura/fecho: como a conta do estúdio é partilhada, o
  // responsável escolhe o seu nome (tal como no formulário antigo).
  const responsavelId = String(formData.get('responsavel_id') ?? '')
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!responsavelId) {
    redirect(`/painel/${estudioSlug}/checklist?error=${encodeURIComponent('Escolhe quem é o responsável por esta checklist.')}`)
  }

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
      pt_id: responsavelId || (userData.user?.id ?? null),
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

// Carrega no modelo a checklist oficial (a do formulário que a equipa
// preenchia). "acrescentar" junta só os itens que ainda não existem;
// "substituir" desativa os itens atuais e fica só com a oficial.
export async function aplicarChecklistPadrao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const substituir = formData.get('modo') === 'substituir'
  const destino = `/painel/${estudioSlug}/checklist`
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehGestao) {
    redirect(`${destino}?error=${encodeURIComponent('Só a gestão pode alterar a checklist.')}`)
  }
  const supabase = await createClient()

  if (substituir) {
    const { error } = await supabase.from('checklist_modelo').update({ ativo: false }).eq('ativo', true)
    if (error) redirect(`${destino}?error=${encodeURIComponent(error.message)}`)
  }
  const { data: atuais, error: erroAtuais } = await supabase
    .from('checklist_modelo')
    .select('tipo, item, ordem')
    .eq('ativo', true)
  if (erroAtuais) redirect(`${destino}?error=${encodeURIComponent(erroAtuais.message)}`)

  const { data: ultimo } = await supabase
    .from('checklist_modelo')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()
  let ordem = (ultimo?.ordem ?? -1) + 1
  const novos: { tipo: TipoOperacao; secao: string; item: string; ordem: number }[] = []
  for (const tipo of Object.keys(CHECKLIST_PADRAO) as TipoOperacao[]) {
    for (const it of itensEmFalta(tipo, (atuais ?? []).filter((a) => a.tipo === tipo))) {
      novos.push({ tipo, ...it, ordem: ordem++ })
    }
  }
  if (novos.length > 0) {
    const { error } = await supabase.from('checklist_modelo').insert(novos)
    if (error) redirect(`${destino}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(destino)
  redirect(`${destino}?ok=${novos.length}`)
}
