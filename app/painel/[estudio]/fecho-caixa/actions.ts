'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { somarNumerario } from '@/lib/data/fechoCaixa'

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

  const { data: clientes, error: erroClientes } = await supabase
    .from('clientes')
    .select('id')
    .eq('estudio_id', estudioId)

  if (erroClientes) {
    redirect(`/painel/${estudioSlug}/fecho-caixa?error=${encodeURIComponent(erroClientes.message)}`)
  }

  const idsClientes = (clientes ?? []).map((c) => c.id)

  const { data: pagamentosHoje, error: erroPagamentos } = idsClientes.length
    ? await supabase
        .from('pagamentos')
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

  revalidatePath(`/painel/${estudioSlug}/fecho-caixa`)
  revalidatePath(`/painel/${estudioSlug}/checklist`)
  redirect(`/painel/${estudioSlug}/fecho-caixa`)
}
