'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { criarPedidoFatura } from '@/lib/data/pedidosFatura'
import { normalizarNif, nifValido } from '@/lib/data/faturas'

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
  const descontoBruto = campoOuNull(formData, 'desconto')
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

  const pedirFatura = formData.get('pedir_fatura') === 'on'
  const nif = normalizarNif(campoOuNull(formData, 'nif'))
  if (pedirFatura && nif && !nifValido(nif)) {
    redirect(
      `/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(
        `O NIF ${nif} não é válido — corrige-o ou deixa em branco (consumidor final).`
      )}`
    )
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const [{ data: inserido, error }, { data: plano }] = await Promise.all([
    supabase.from('pagamentos').insert({
      cliente_id: clienteId,
      plano_id: planoId,
      valor: Number(valorBruto),
      desconto: descontoBruto ? Number(descontoBruto) : 0,
      metodo,
      data_pagamento: dataPagamento,
      valido_ate: validoAte,
      inclui_inscricao: formData.get('inclui_inscricao') === 'on',
      inclui_seguro: formData.get('inclui_seguro') === 'on',
      inclui_reativacao: formData.get('inclui_reativacao') === 'on',
      nota: campoOuNull(formData, 'nota'),
      registado_por: userData.user?.id ?? null,
    }).select('id').single(),
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

  // "Pedir fatura": só cria um pedido pendente para a Administração
  // validar — nunca emite nada daqui. O NIF indicado fica na ficha.
  let erroFatura: string | null = null
  if (pedirFatura && inserido?.id) {
    if (nif) await supabase.from('clientes').update({ nif }).eq('id', clienteId)
    erroFatura = await criarPedidoFatura(supabase, {
      pagamentoId: inserido.id,
      pedidoPor: userData.user?.id ?? null,
      nota: campoOuNull(formData, 'nota_fatura'),
    })
  }

  revalidatePath(`/painel/${estudioSlug}/pagamentos`)
  revalidatePath(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/clientes`)
  revalidatePath(`/painel/${estudioSlug}/clientes/${clienteId}`)
  revalidatePath('/painel/admin', 'layout')
  if (erroFatura) {
    redirect(
      `/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(
        `Pagamento registado, mas o pedido de fatura falhou: ${erroFatura}`
      )}`
    )
  }
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
    .from('pagamentos_ativos')
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

// Nunca apaga a sério — fica a linha, marcada como anulada (quem,
// quando, porquê), para nunca desaparecer dinheiro sem deixar rasto.
// Qualquer PT/funcionário consegue (decisão do dono: a restrição à
// gestão trocou-se por um alerta sempre enviado à administração em
// vez de bloquear a ação); um gatilho na base de dados impede quem
// não é gestão de alterar outra coisa no pagamento além disto.
export async function anularPagamento(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const motivo = campoOuNull(formData, 'motivo')
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('nome, estudio_id')
    .eq('id', clienteId)
    .maybeSingle()

  const { error } = await supabase
    .from('pagamentos')
    .update({
      anulado_em: new Date().toISOString(),
      anulado_por: userData.user?.id ?? null,
      motivo_anulacao: motivo,
    })
    .eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/pagamentos/${clienteId}?error=${encodeURIComponent(error.message)}`
    )
  }

  if (cliente) {
    await supabase.from('alerts').insert({
      estudio_id: cliente.estudio_id,
      regra_chave: 'pagamento_anulado',
      severidade: 'Crítico' as const,
      titulo: `${cliente.nome}: pagamento anulado`,
      descricao: motivo
        ? `Motivo indicado: ${motivo}. Confirma na ficha do cliente quem anulou e quando.`
        : 'Sem motivo indicado. Confirma na ficha do cliente quem anulou e quando.',
      cliente_id: clienteId,
    })
  }

  revalidatePath(`/painel/${estudioSlug}/pagamentos`)
  revalidatePath(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
}
