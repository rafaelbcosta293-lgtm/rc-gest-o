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

  // Plano, valor, método, data de pagamento e válido até são sempre
  // obrigatórios — o formulário já impede isto com "required", mas
  // confirma-se aqui também (nunca confiar só na validação do browser).
  const planoId = campoOuNull(formData, 'plano_id')
  const valorBruto = campoOuNull(formData, 'valor')
  const metodo = campoOuNull(formData, 'metodo')
  const dataPagamento = campoOuNull(formData, 'data_pagamento')
  const validoAte = campoOuNull(formData, 'valido_ate')
  if (!planoId || !valorBruto || !metodo || !dataPagamento || !validoAte) {
    redirect(
      `/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(
        'Plano, valor, método, data de pagamento e válido até são obrigatórios.'
      )}`
    )
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const [{ error }, { data: plano }] = await Promise.all([
    supabase.from('pagamentos').insert({
      cliente_id: clienteId,
      plano_id: planoId,
      valor: Number(valorBruto),
      metodo,
      data_pagamento: dataPagamento,
      valido_ate: validoAte,
      inclui_inscricao: formData.get('inclui_inscricao') === 'on',
      inclui_seguro: formData.get('inclui_seguro') === 'on',
      inclui_reativacao: formData.get('inclui_reativacao') === 'on',
      nota: campoOuNull(formData, 'nota'),
      registado_por: userData.user?.id ?? null,
    }),
    supabase.from('planos').select('sessoes_por_semana').eq('id', planoId).maybeSingle(),
  ])

  if (error) {
    redirect(
      `/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(error.message)}`
    )
  }

  // Uma mensalidade paga é o sinal mais forte de que o cliente está
  // ativo: reativa sempre, mesmo que o estado tivesse sido alterado à
  // mão antes (essa exceção manual só vale até ao pagamento seguinte).
  // O plano escolhido já diz quantas vezes por semana a pessoa treina —
  // ajusta sempre a frequência do cliente a esse valor, para nunca ficar
  // desatualizada quando o cliente muda de pacote.
  await supabase
    .from('clientes')
    .update({
      estado: 'Ativo',
      estado_automatico: true,
      ...(plano?.sessoes_por_semana != null ? { frequencia_semanal: plano.sessoes_por_semana } : {}),
    })
    .eq('id', clienteId)

  revalidatePath(`/painel/${estudioSlug}/pagamentos`)
  revalidatePath(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/clientes`)
  revalidatePath(`/painel/${estudioSlug}/clientes/${clienteId}`)
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
