'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calcularFechoCaixa, somarNumerario, somarSaidas } from '@/lib/data/fechoCaixa'
import { fmt } from '@/lib/data/presencas'

const REGRA_DIFERENCA_FECHO = 'fecho_caixa_diferenca'

// O saldo anterior nunca é introduzido à mão — é sempre o valor
// contado no fecho mais recente antes de hoje (normalmente ontem;
// se um dia ficar sem fecho, usa o último que existir, para a
// contagem nunca perder o fio).
async function obterSaldoAnterior(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estudioId: number,
  hoje: string
): Promise<number> {
  const { data } = await supabase
    .from('fechos_caixa')
    .select('valor_contado')
    .eq('estudio_id', estudioId)
    .lt('data', hoje)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? Number(data.valor_contado) : 0
}

export async function registarFechoCaixa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const valorContado = Number(formData.get('valor_contado'))
  const nota = (formData.get('nota') as string)?.trim() || null
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  if (!Number.isFinite(valorContado)) {
    redirect(
      `/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent('Indica o valor contado em caixa.')}`
    )
  }

  const { data: userData } = await supabase.auth.getUser()

  const [
    { data: estudio, error: erroEstudio },
    { data: clientes, error: erroClientes },
  ] = await Promise.all([
    supabase.from('estudios').select('nome').eq('id', estudioId).single(),
    supabase.from('clientes').select('id').eq('estudio_id', estudioId),
  ])

  if (erroEstudio || erroClientes) {
    redirect(
      `/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent((erroEstudio ?? erroClientes)!.message)}`
    )
  }

  const idsClientes = (clientes ?? []).map((c) => c.id)

  const [
    { data: pagamentosHoje, error: erroPagamentos },
    { data: saidasHoje, error: erroSaidas },
    { data: outrosHoje, error: erroOutros },
  ] = await Promise.all([
    idsClientes.length
      ? supabase
          .from('pagamentos_ativos')
          .select('valor, metodo')
          .in('cliente_id', idsClientes)
          .eq('data_pagamento', hoje)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('saidas_caixa_ativas').select('valor').eq('estudio_id', estudioId).eq('data', hoje),
    supabase.from('outros_caixa_ativos').select('tipo, valor').eq('estudio_id', estudioId).eq('data', hoje),
  ])

  if (erroPagamentos || erroSaidas || erroOutros) {
    redirect(
      `/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent((erroPagamentos ?? erroSaidas ?? erroOutros)!.message)}`
    )
  }

  const valorNumerarioDia = somarNumerario(
    (pagamentosHoje ?? []).map((p) => ({ valor: Number(p.valor), metodo: p.metodo }))
  )
  const saidasCaixaDia = somarSaidas((saidasHoje ?? []).map((s) => ({ valor: Number(s.valor) })))
  const outrosEntradaDia = somarSaidas(
    (outrosHoje ?? []).filter((o) => o.tipo === 'Entrada').map((o) => ({ valor: Number(o.valor) }))
  )
  const outrosSaidaDia = somarSaidas(
    (outrosHoje ?? []).filter((o) => o.tipo === 'Saída').map((o) => ({ valor: Number(o.valor) }))
  )
  const saldoAnterior = await obterSaldoAnterior(supabase, estudioId, hoje)
  const { diferenca } = calcularFechoCaixa({
    saldoAnterior,
    valorNumerarioDia,
    saidasCaixaDia,
    outrosEntradaDia,
    outrosSaidaDia,
    valorContado,
  })

  const { error } = await supabase.from('fechos_caixa').upsert(
    {
      estudio_id: estudioId,
      data: hoje,
      valor_numerario_dia: valorNumerarioDia,
      saldo_anterior: saldoAnterior,
      saidas_caixa_dia: saidasCaixaDia,
      outros_entrada_dia: outrosEntradaDia,
      outros_saida_dia: outrosSaidaDia,
      valor_contado: valorContado,
      nota,
      registado_por: userData.user?.id ?? null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'estudio_id,data' }
  )

  if (error) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent(error.message)}`)
  }

  await avisarGestaoSeDiferente(supabase, estudioId, estudio?.nome ?? estudioSlug, hoje, diferenca)

  revalidatePath(`/painel/${estudioSlug}/fecho-caixa`)
  revalidatePath(`/painel/${estudioSlug}/checklist`)
  redirect(`/painel/${estudioSlug}/fecho-caixa`)
}

// Nunca diz o valor da diferença (regra geral dos alertas: nunca
// valores em € na descrição) — só que há uma, para a gestão ir ver o
// fecho. Sem papel_destinatario definido, fica só visível à gestão
// (ver app/painel/[estudio]/alertas/page.tsx). Resolve sempre o
// alerta anterior deste mesmo dia primeiro, para uma correção ao
// valor contado não deixar duplicados nem alertas "fantasma" depois
// de a diferença ser corrigida para zero.
async function avisarGestaoSeDiferente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estudioId: number,
  estudioNome: string,
  hoje: string,
  diferenca: number
) {
  const titulo = `Fecho de caixa (${estudioNome}) de ${fmt(hoje)} com diferença`

  await supabase
    .from('alerts')
    .update({ estado: 'Resolvido', resolvido_em: new Date().toISOString() })
    .eq('estudio_id', estudioId)
    .eq('regra_chave', REGRA_DIFERENCA_FECHO)
    .eq('titulo', titulo)
    .neq('estado', 'Resolvido')

  if (diferenca === 0) return

  await supabase.from('alerts').insert({
    estudio_id: estudioId,
    regra_chave: REGRA_DIFERENCA_FECHO,
    severidade: 'Crítico' as const,
    titulo,
    descricao:
      'O valor contado na caixa não coincide com o valor esperado (saldo anterior + numerário recebido hoje). ' +
      'Confirma o fecho de caixa deste dia.',
  })
}

// Sangria ou compra pagas com o dinheiro da gaveta — qualquer
// PT/funcionário pode registar (mesma regra já decidida para o resto
// do fecho de caixa), sem gestão.
export async function registarSaidaCaixa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const tipo = formData.get('tipo') as string
  const valor = Number(formData.get('valor'))
  const descricao = (formData.get('descricao') as string)?.trim() || null
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  if (!Number.isFinite(valor) || valor <= 0) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent('Indica o valor da saída.')}`)
  }

  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('saidas_caixa').insert({
    estudio_id: estudioId,
    data: hoje,
    tipo,
    valor,
    descricao,
    registado_por: userData.user?.id ?? null,
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/fecho-caixa`)
  redirect(`/painel/${estudioSlug}/fecho-caixa`)
}

// "Outros" — qualquer entrada ou saída de caixa que não é pagamento de
// cliente nem sangria/compra (ex.: um documento à parte). Qualquer
// PT/funcionário pode registar, tal como as saídas normais.
export async function registarOutroCaixa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const tipo = formData.get('tipo') as string
  const valor = Number(formData.get('valor'))
  const documento = (formData.get('documento') as string)?.trim() || null
  const descricao = (formData.get('descricao') as string)?.trim() || null
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  if (!Number.isFinite(valor) || valor <= 0) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent('Indica o valor.')}`)
  }

  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('outros_caixa').insert({
    estudio_id: estudioId,
    data: hoje,
    tipo,
    documento,
    descricao,
    valor,
    registado_por: userData.user?.id ?? null,
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/fecho-caixa`)
  redirect(`/painel/${estudioSlug}/fecho-caixa`)
}

// Nunca apaga a sério — fica a linha, marcada como anulada (quem,
// quando, porquê). Só a gestão consegue (RLS "anular_outros_caixa",
// e_gestao()).
export async function anularOutroCaixa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const motivo = (formData.get('motivo') as string)?.trim() || null
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('outros_caixa')
    .update({
      anulado_em: new Date().toISOString(),
      anulado_por: userData.user?.id ?? null,
      motivo_anulacao: motivo,
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/fecho-caixa`)
  redirect(`/painel/${estudioSlug}/fecho-caixa`)
}

// Nunca apaga a sério — fica a linha, marcada como anulada (quem,
// quando, porquê), tal como a anulação de pagamentos. Só a gestão
// consegue (RLS "anular_saidas_caixa", e_gestao()).
export async function anularSaidaCaixa(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const motivo = (formData.get('motivo') as string)?.trim() || null
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('saidas_caixa')
    .update({
      anulado_em: new Date().toISOString(),
      anulado_por: userData.user?.id ?? null,
      motivo_anulacao: motivo,
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/fecho-caixa`)
  redirect(`/painel/${estudioSlug}/fecho-caixa`)
}
