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

// Regista só a renovação do seguro, sem exigir uma mensalidade junto
// (ao contrário de criarPagamento, que serve para o pagamento completo).
// Não mexe no estado da mensalidade do cliente: reaproveita o plano e o
// "válido até" do último pagamento já existente (ou, não havendo
// nenhum, usa a própria data deste pagamento) — nunca pior do que já
// estava, só acrescenta o seguro.
export async function registarPagamentoSeguro(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const valor = Number(formData.get('valor'))
  const dataPagamento =
    campoOuNull(formData, 'data_pagamento') ?? new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { data: ultimoPagamento, error: erroUltimo } = await supabase
    .from('pagamentos')
    .select('plano_id, valido_ate')
    .eq('cliente_id', clienteId)
    .order('data_pagamento', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (erroUltimo) {
    redirect(`/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(erroUltimo.message)}`)
  }

  const { error } = await supabase.from('pagamentos').insert({
    cliente_id: clienteId,
    plano_id: ultimoPagamento?.plano_id ?? null,
    valor,
    data_pagamento: dataPagamento,
    valido_ate: ultimoPagamento?.valido_ate ?? dataPagamento,
    inclui_seguro: true,
    nota: 'Pagamento do seguro',
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
