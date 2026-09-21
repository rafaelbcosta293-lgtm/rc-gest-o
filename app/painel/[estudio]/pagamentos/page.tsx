import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt, treinosNoPeriodo } from '@/lib/data/presencas'
import type { EstadoPagamento } from '@/lib/supabase/database.types'

type PagamentoDetalhe = {
  cliente_id: string
  data_pagamento: string
  valido_ate: string
  plano: { nome: string; sessoes_por_semana: number | null } | null
}

type ClientePagamento = EstadoPagamento & {
  tipoMensalidade: string | null
  realizados: number
  adquiridos: number | null
}

function LinhaPagamento({ slug, cliente, variante }: {
  slug: string
  cliente: ClientePagamento
  variante: 'atrasado' | 'emDia'
}) {
  const cores =
    variante === 'atrasado'
      ? 'border-red-200 bg-red-50 hover:border-red-300 dark:border-red-900 dark:bg-red-950'
      : 'border-black/10 bg-white hover:border-black/30 dark:border-white/10 dark:bg-zinc-950'
  return (
    <Link
      href={`/painel/${slug}/pagamentos/${cliente.cliente_id}`}
      className={`flex flex-col gap-1.5 rounded-xl border p-4 transition-colors ${cores}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-black dark:text-zinc-50">{cliente.nome}</span>
        <span
          className={`text-xs font-medium ${
            variante === 'atrasado' ? 'text-red-700 dark:text-red-300' : 'text-teal-700 dark:text-teal-400'
          }`}
        >
          {variante === 'atrasado'
            ? cliente.valido_ate
              ? `venceu em ${fmt(cliente.valido_ate)}`
              : 'sem pagamentos'
            : `válido até ${fmt(cliente.valido_ate)}`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span>{cliente.tipoMensalidade ?? 'sem plano associado'}</span>
        {cliente.adquiridos != null && (
          <span>
            · {cliente.realizados} de {cliente.adquiridos} treinos
          </span>
        )}
      </div>
    </Link>
  )
}

export default async function PagamentosPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const { data, error } = await supabase
    .from('v_estado_pagamento')
    .select('*')
    .eq('estudio_id', estudio.id)
    .order('nome')

  if (error) {
    throw new Error(error.message)
  }

  const clientes = (data ?? []) as EstadoPagamento[]
  const idsClientes = clientes.map((c) => c.cliente_id)
  const hoje = new Date().toISOString().slice(0, 10)

  const { data: pagamentosData, error: erroPagamentosDetalhe } = idsClientes.length
    ? await supabase
        .from('pagamentos')
        .select('cliente_id, data_pagamento, valido_ate, plano:planos(nome, sessoes_por_semana)')
        .in('cliente_id', idsClientes)
        .order('data_pagamento', { ascending: false })
    : { data: [], error: null }
  if (erroPagamentosDetalhe) {
    throw new Error(erroPagamentosDetalhe.message)
  }

  // A consulta já vem ordenada por data decrescente, por isso a primeira
  // ocorrência de cada cliente é o pagamento mais recente.
  const ultimoPagamentoPorCliente = new Map<string, PagamentoDetalhe>()
  for (const p of (pagamentosData ?? []) as unknown as PagamentoDetalhe[]) {
    if (!ultimoPagamentoPorCliente.has(p.cliente_id)) {
      ultimoPagamentoPorCliente.set(p.cliente_id, p)
    }
  }

  const datasInicio = [...ultimoPagamentoPorCliente.values()].map((p) => p.data_pagamento)
  const dataMinima = datasInicio.length
    ? datasInicio.reduce((a, b) => (a < b ? a : b))
    : hoje

  const { data: presencasData, error: erroPresencasDetalhe } = idsClientes.length
    ? await supabase
        .from('presencas')
        .select('cliente_id, data')
        .in('cliente_id', idsClientes)
        .eq('estado', 'Presente')
        .gte('data', dataMinima)
    : { data: [], error: null }
  if (erroPresencasDetalhe) {
    throw new Error(erroPresencasDetalhe.message)
  }

  const presencasPorCliente = new Map<string, string[]>()
  for (const p of presencasData ?? []) {
    const lista = presencasPorCliente.get(p.cliente_id) ?? []
    lista.push(p.data)
    presencasPorCliente.set(p.cliente_id, lista)
  }

  const clientesComResumo: ClientePagamento[] = clientes.map((c) => {
    const pagamento = ultimoPagamentoPorCliente.get(c.cliente_id)
    if (!pagamento) {
      return { ...c, tipoMensalidade: null, realizados: 0, adquiridos: null }
    }
    const fimPeriodo = pagamento.valido_ate < hoje ? pagamento.valido_ate : hoje
    const adquiridos = treinosNoPeriodo(
      pagamento.plano?.sessoes_por_semana ?? null,
      pagamento.data_pagamento,
      fimPeriodo
    )
    const realizados = (presencasPorCliente.get(c.cliente_id) ?? []).filter(
      (d) => d >= pagamento.data_pagamento && d <= fimPeriodo
    ).length
    return { ...c, tipoMensalidade: pagamento.plano?.nome ?? null, realizados, adquiridos }
  })

  const emDia = clientesComResumo.filter((c) => c.em_dia)
  const atrasados = clientesComResumo.filter((c) => !c.em_dia)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Pagamentos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · {atrasados.length} {atrasados.length === 1 ? 'atrasado' : 'atrasados'} de{' '}
        {clientes.length} clientes ativos.
      </p>

      {atrasados.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-red-600">
            Por regularizar ({atrasados.length})
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {atrasados.map((c) => (
              <LinhaPagamento key={c.cliente_id} slug={slug} cliente={c} variante="atrasado" />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Em dia ({emDia.length})
      </h2>
      <div className="mt-2 flex flex-col gap-2">
        {emDia.map((c) => (
          <LinhaPagamento key={c.cliente_id} slug={slug} cliente={c} variante="emDia" />
        ))}
      </div>

      {clientes.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há clientes ativos neste estúdio.
        </div>
      )}
    </div>
  )
}
