'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { criarPedidoFatura } from '@/lib/data/pedidosFatura'
import { normalizarNif, nifValido } from '@/lib/data/faturas'
import { calcularTransicaoAutomatica } from '@/lib/data/estadoClientes'

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
    .eq('mensalidade', true)
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
    // Um seguro é um extra: conta em euros, nunca como mensalidade
    // (não faz de ninguém um cliente ativo ou pagante).
    mensalidade: false,
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
    .select('nome, estudio_id, estado, estado_automatico')
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

  // Anular um pagamento pode deixar o cliente sem nenhuma mensalidade
  // em dia (ex.: foi o único pagamento, ou o mais recente) — sem isto,
  // o cliente ficava "Ativo" até ao cron da noite recalcular, e
  // aparecia entretanto como pagamento em dia (ex.: em Presenças).
  // Reaproveita-se a mesma regra do cron (calcularTransicaoAutomatica):
  // nunca mexe em quem está Suspenso/Inativo nem em quem teve o estado
  // alterado à mão, e nunca reativa — só pode andar para trás.
  if (cliente?.estado_automatico) {
    const { data: ultimoAtivo } = await supabase
      .from('pagamentos_ativos')
      .select('valido_ate')
      .eq('cliente_id', clienteId)
      .eq('mensalidade', true)
      .order('valido_ate', { ascending: false })
      .limit(1)
      .maybeSingle()

    const novoEstado = calcularTransicaoAutomatica(
      {
        id: clienteId,
        estado: cliente.estado,
        estadoAutomatico: cliente.estado_automatico,
        validoAte: ultimoAtivo?.valido_ate ?? null,
      },
      new Date().toISOString().slice(0, 10)
    )
    if (novoEstado) {
      await supabase.from('clientes').update({ estado: novoEstado }).eq('id', clienteId)
    }
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
  revalidatePath(`/painel/${estudioSlug}/clientes`)
  revalidatePath(`/painel/${estudioSlug}/clientes/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/presencas`)
  revalidatePath('/painel/admin', 'layout')
  redirect(`/painel/${estudioSlug}/pagamentos/${clienteId}`)
}

// ── Venda de produtos (bar, merchandising…) ──────────────────────────
// Fica em receitas_outras com a categoria do produto: entra nas contas
// em euros e no fecho de caixa, nunca como mensalidade nem como cliente.

const METODOS_VENDA = ['Numerário', 'Multibanco', 'MB Way', 'Transferência']

function voltarVendas(slug: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(params).toString()
  revalidatePath(`/painel/${slug}/pagamentos`)
  revalidatePath(`/painel/${slug}/fecho-caixa`)
  redirect(`/painel/${slug}/pagamentos${qs ? `?${qs}` : ''}#vendas`)
}

export async function registarVendaProduto(formData: FormData) {
  const slug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const produtoId = campoOuNull(formData, 'produto_id')
  const quantidade = Math.floor(Number(formData.get('quantidade')))
  const metodo = campoOuNull(formData, 'metodo')
  const clienteId = campoOuNull(formData, 'cliente_id')
  const valorTexto = campoOuNull(formData, 'valor')
  if (!estudioId || !produtoId || !metodo || !(quantidade >= 1 && quantidade <= 999)) {
    voltarVendas(slug, { erroVenda: 'Escolhe o produto, a quantidade e o método de pagamento.' })
  }
  if (!METODOS_VENDA.includes(metodo)) voltarVendas(slug, { erroVenda: 'Método de pagamento inválido.' })

  const supabase = await createClient()
  const { data: produto, error: erroProduto } = await supabase
    .from('produtos')
    .select('id, nome, valor, ativo, categoria:produto_categorias(nome)')
    .eq('id', produtoId)
    .maybeSingle()
  if (erroProduto || !produto || !produto.ativo) voltarVendas(slug, { erroVenda: 'Produto não encontrado.' })

  const precoTabela = Math.round(Number(produto.valor) * quantidade * 100) / 100
  const valor = valorTexto ? Number(valorTexto.replace(/\s/g, '').replace(',', '.')) : precoTabela
  if (!Number.isFinite(valor) || valor < 0) voltarVendas(slug, { erroVenda: 'O total não é um valor válido.' })

  const categoria = produto.categoria as unknown as { nome: string } | { nome: string }[] | null
  const nomeCategoria = (Array.isArray(categoria) ? categoria[0]?.nome : categoria?.nome) ?? 'Produtos'
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())

  const { error } = await supabase.from('receitas_outras').insert({
    estudio_id: estudioId,
    data: hoje,
    categoria: nomeCategoria,
    descricao: quantidade > 1 ? `${quantidade} × ${produto.nome}` : produto.nome,
    valor: Math.round(valor * 100) / 100,
    metodo,
    origem: 'venda',
    produto_id: produto.id,
    quantidade,
    cliente_id: clienteId,
  })
  if (error) voltarVendas(slug, { erroVenda: error.message })
  voltarVendas(slug, { venda: 'ok' })
}

export async function anularVendaProduto(formData: FormData) {
  const slug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('receitas_outras')
    .update({ anulado_em: new Date().toISOString(), anulado_por: user?.id ?? null, motivo_anulacao: 'Venda anulada' })
    .eq('id', id)
    .eq('origem', 'venda')
  if (error) voltarVendas(slug, { erroVenda: error.message })
  voltarVendas(slug, { venda: 'anulada' })
}
