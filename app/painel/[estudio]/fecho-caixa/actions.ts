'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calcularFechoCaixa, somarNumerario } from '@/lib/data/fechoCaixa'
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

  const { data: pagamentosHoje, error: erroPagamentos } = idsClientes.length
    ? await supabase
        .from('pagamentos_ativos')
        .select('valor, metodo')
        .in('cliente_id', idsClientes)
        .eq('data_pagamento', hoje)
    : { data: [], error: null }

  if (erroPagamentos) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent(erroPagamentos.message)}`)
  }

  const valorNumerarioDia = somarNumerario(
    (pagamentosHoje ?? []).map((p) => ({ valor: Number(p.valor), metodo: p.metodo }))
  )
  const saldoAnterior = await obterSaldoAnterior(supabase, estudioId, hoje)
  const { diferenca } = calcularFechoCaixa({ saldoAnterior, valorNumerarioDia, valorContado })

  const { error } = await supabase.from('fechos_caixa').upsert(
    {
      estudio_id: estudioId,
      data: hoje,
      valor_numerario_dia: valorNumerarioDia,
      saldo_anterior: saldoAnterior,
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
