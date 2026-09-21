'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export async function criarPagamento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('pagamentos').insert({
    cliente_id: clienteId,
    plano_id: campoOuNull(formData, 'plano_id'),
    valor: Number(formData.get('valor')),
    metodo: campoOuNull(formData, 'metodo'),
    data_pagamento: formData.get('data_pagamento') as string,
    valido_ate: formData.get('valido_ate') as string,
    inclui_inscricao: formData.get('inclui_inscricao') === 'on',
    inclui_seguro: formData.get('inclui_seguro') === 'on',
    inclui_reativacao: formData.get('inclui_reativacao') === 'on',
    nota: campoOuNull(formData, 'nota'),
    registado_por: userData.user?.id ?? null,
  })

  if (error) {
    redirect(
      `/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/pagamentos`)
  revalidatePath(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
}

export async function apagarPagamento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('pagamentos').delete().eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/pagamentos`)
  revalidatePath(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
}
