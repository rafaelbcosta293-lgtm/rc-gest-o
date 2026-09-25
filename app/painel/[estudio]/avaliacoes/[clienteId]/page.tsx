import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { apagarAvaliacao } from '../actions'
import SubmitButton from '@/components/SubmitButton'
import type { Avaliacao } from '@/lib/supabase/database.types'

type AvaliacaoComPt = Avaliacao & { pt: { nome: string } | null }

function diferenca(atual: number | null, anterior: number | null) {
  if (atual === null || anterior === null) return null
  const d = Math.round((atual - anterior) * 10) / 10
  return d
}

export default async function AvaliacoesClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [estudio, { data: cliente }, { data: avaliacoesData, error: erroAvaliacoes }] =
    await Promise.all([
      getEstudioPorSlug(supabase, slug),
      supabase.from('clientes').select('id, nome, estudio_id').eq('id', clienteId).maybeSingle(),
      supabase
        .from('avaliacoes')
        .select('*, pt:perfis!pt_id(nome)')
        .eq('cliente_id', clienteId)
        .order('data', { ascending: false }),
    ])

  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  if (erroAvaliacoes) {
    throw new Error(erroAvaliacoes.message)
  }

  const lista = (avaliacoesData ?? []) as unknown as AvaliacaoComPt[]
  const [atual, anterior] = lista

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/avaliacoes`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Avaliações
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          {cliente.nome}
        </h1>
        <Link
          href={`/painel/${slug}/avaliacoes/${clienteId}/nova`}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
        >
          + Avaliação
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {atual && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-black dark:text-zinc-50">
              {atual.peso_kg ?? '—'}
            </strong>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              peso (kg){' '}
              {anterior && diferenca(atual.peso_kg, anterior.peso_kg) !== null && (
                <>· {diferenca(atual.peso_kg, anterior.peso_kg)! > 0 ? '+' : ''}
                  {diferenca(atual.peso_kg, anterior.peso_kg)}</>
              )}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-black dark:text-zinc-50">
              {atual.massa_gorda_pct ?? '—'}
            </strong>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              massa gorda (%){' '}
              {anterior &&
                diferenca(atual.massa_gorda_pct, anterior.massa_gorda_pct) !== null && (
                  <>· {diferenca(atual.massa_gorda_pct, anterior.massa_gorda_pct)! > 0 ? '+' : ''}
                    {diferenca(atual.massa_gorda_pct, anterior.massa_gorda_pct)}</>
                )}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-black dark:text-zinc-50">
              {atual.massa_muscular_kg ?? '—'}
            </strong>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">massa muscular (kg)</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-black dark:text-zinc-50">
              {atual.massa_gorda_kg ?? '—'}
            </strong>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">massa gorda (kg)</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-black dark:text-zinc-50">
              {atual.imc ?? '—'}
            </strong>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">IMC</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-black dark:text-zinc-50">
              {atual.idade_metabolica ?? '—'}
            </strong>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">idade metabólica</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-black dark:text-zinc-50">
              {atual.densidade_ossea ?? '—'}
            </strong>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">densidade óssea (kg)</span>
          </div>
        </div>
      )}

      {atual?.proxima_reavaliacao && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
          <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Próxima reavaliação
          </div>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
            {fmt(atual.proxima_reavaliacao)}
          </p>
        </div>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico ({lista.length})
      </h2>

      {lista.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há avaliações registadas para {cliente.nome}.
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {lista.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="w-20 text-xs text-zinc-500">{fmt(a.data)}</span>
            <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-400">
              {a.peso_kg ? `${a.peso_kg} kg` : '—'}
              {a.massa_gorda_pct ? ` · ${a.massa_gorda_pct}% gordura` : ''}
              {a.pt ? ` · ${a.pt.nome}` : ''}
            </span>
            <Link
              href={`/painel/${slug}/avaliacoes/${clienteId}/${a.id}/editar`}
              className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
            >
              Editar
            </Link>
            <form action={apagarAvaliacao}>
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="cliente_id" value={clienteId} />
              <input type="hidden" name="id" value={a.id} />
              <SubmitButton
                pendingText="…"
                aria-label="Apagar"
                className="text-lg text-zinc-400 hover:text-red-600"
              >
                ×
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
