'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  chaveAtivoDispositivo,
  autorizarEsteComputador,
  removerAutorizacaoEsteComputador,
} from '@/lib/data/dispositivo'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export async function guardarConfig(formData: FormData) {
  const chave = formData.get('chave') as string
  const valor = campoOuNull(formData, 'valor')
  const supabase = await createClient()

  const { error } = await supabase.from('config').update({ valor }).eq('chave', chave)

  if (error) {
    redirect(`/painel/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}

// Password de acesso a Administração/Coordenação — campo fica sempre em
// branco (nunca mostra a password atual). Só grava quando se escreve
// algo de novo, para não se apagar sem querer ao guardar o formulário
// vazio. Usa upsert porque a linha em "config" pode ainda não existir.
export async function guardarSenha(formData: FormData) {
  const chave = formData.get('chave') as string
  const senha = campoOuNull(formData, 'senha')
  const supabase = await createClient()

  if (!senha) {
    redirect('/painel/admin/servicos')
  }

  const { error } = await supabase.from('config').upsert({ chave, valor: senha }, { onConflict: 'chave' })

  if (error) {
    redirect(`/painel/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}

// Liga/desliga a restrição por computador da conta partilhada de um
// estúdio (ver lib/data/dispositivo.ts). Autoriza sempre primeiro todos
// os computadores desse estúdio antes de ativar, para não ficarem
// presos fora da própria conta.
export async function alternarRestricaoDispositivo(formData: FormData) {
  const estudio = formData.get('estudio') as string
  const ativo = formData.get('ativo') === 'on'
  const chave = chaveAtivoDispositivo(estudio)
  if (!chave) redirect('/painel/admin/servicos')

  const supabase = await createClient()
  const { error } = await supabase
    .from('config')
    .upsert({ chave, valor: ativo ? 'sim' : null }, { onConflict: 'chave' })

  if (error) {
    redirect(`/painel/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}

// Autoriza/remove a autorização do computador onde se está a clicar
// (cookie local a este browser, nunca guardado no servidor).
export async function autorizarEsteComputadorAction(formData: FormData) {
  const estudio = formData.get('estudio') as string
  await autorizarEsteComputador(estudio)
  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}

export async function removerAutorizacaoEsteComputadorAction(formData: FormData) {
  const estudio = formData.get('estudio') as string
  await removerAutorizacaoEsteComputador(estudio)
  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}

export async function criarPlano(formData: FormData) {
  const supabase = await createClient()

  // Entra sempre no fim da lista — a ordem de leitura (maior "ordem")
  // decide o fim, não a data de criação nem o preço.
  const { data: ultimo } = await supabase
    .from('planos')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('planos').insert({
    nome: formData.get('nome') as string,
    valor: Number(formData.get('valor')),
    sessoes_por_semana: formData.get('sessoes_por_semana')
      ? Number(formData.get('sessoes_por_semana'))
      : null,
    ordem: (ultimo?.ordem ?? 0) + 1,
  })

  if (error) {
    redirect(`/painel/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}

export async function atualizarPlano(formData: FormData) {
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('planos')
    .update({
      nome: formData.get('nome') as string,
      valor: Number(formData.get('valor')),
      sessoes_por_semana: formData.get('sessoes_por_semana')
        ? Number(formData.get('sessoes_por_semana'))
        : null,
      ativo: formData.get('ativo') === 'on',
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}

// Chamada diretamente (sem <form>/redirect) ao soltar um serviço
// arrastado — grava a ordem nova da lista toda de uma vez.
export async function reordenarPlanos(ids: string[]): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()

  const resultados = await Promise.all(
    ids.map((id, i) => supabase.from('planos').update({ ordem: i + 1 }).eq('id', id))
  )
  const comErro = resultados.find((r) => r.error)
  if (comErro?.error) return { error: comErro.error.message }

  revalidatePath('/painel/admin/servicos')
  return { ok: true }
}

export async function apagarPlano(formData: FormData) {
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('planos').delete().eq('id', id)

  if (error) {
    redirect(`/painel/admin/servicos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/painel/admin/servicos')
  redirect('/painel/admin/servicos')
}
