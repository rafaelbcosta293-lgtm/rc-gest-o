import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import type { EstadoPagamento } from '@/lib/supabase/database.types'

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
  const emDia = clientes.filter((c) => c.em_dia)
  const atrasados = clientes.filter((c) => !c.em_dia)

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
              <Link
                key={c.cliente_id}
                href={`/painel/${slug}/pagamentos/${c.cliente_id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 transition-colors hover:border-red-300 dark:border-red-900 dark:bg-red-950"
              >
                <span className="font-medium text-black dark:text-zinc-50">{c.nome}</span>
                <span className="text-xs text-red-700 dark:text-red-300">
                  {c.valido_ate ? `venceu em ${fmt(c.valido_ate)}` : 'sem pagamentos'}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Em dia ({emDia.length})
      </h2>
      <div className="mt-2 flex flex-col gap-2">
        {emDia.map((c) => (
          <Link
            key={c.cliente_id}
            href={`/painel/${slug}/pagamentos/${c.cliente_id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="font-medium text-black dark:text-zinc-50">{c.nome}</span>
            <span className="text-xs text-teal-700 dark:text-teal-400">
              válido até {fmt(c.valido_ate)}
            </span>
          </Link>
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
