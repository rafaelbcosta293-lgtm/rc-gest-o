import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { apagarAvaliacao } from '../actions'
import ApagarComConfirmacao from '@/components/ApagarComConfirmacao'
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/avaliacoes`}
        className="text-sm text-muted underline"
      >
        ← Avaliações
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          {cliente.nome}
        </h1>
        <Link
          href={`/painel/${slug}/avaliacoes/${clienteId}/nova`}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
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
            <strong className="block text-lg text-foreground">
              {atual.peso_kg ?? '—'}
            </strong>
            <span className="text-xs text-muted">
              peso (kg){' '}
              {anterior && diferenca(atual.peso_kg, anterior.peso_kg) !== null && (
                <>· {diferenca(atual.peso_kg, anterior.peso_kg)! > 0 ? '+' : ''}
                  {diferenca(atual.peso_kg, anterior.peso_kg)}</>
              )}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-foreground">
              {atual.massa_gorda_pct ?? '—'}
            </strong>
            <span className="text-xs text-muted">
              massa gorda (%){' '}
              {anterior &&
                diferenca(atual.massa_gorda_pct, anterior.massa_gorda_pct) !== null && (
                  <>· {diferenca(atual.massa_gorda_pct, anterior.massa_gorda_pct)! > 0 ? '+' : ''}
                    {diferenca(atual.massa_gorda_pct, anterior.massa_gorda_pct)}</>
                )}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-foreground">
              {atual.massa_muscular_kg ?? '—'}
            </strong>
            <span className="text-xs text-muted">massa muscular (kg)</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-foreground">
              {atual.massa_gorda_kg ?? '—'}
            </strong>
            <span className="text-xs text-muted">massa gorda (kg)</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-foreground">
              {atual.imc ?? '—'}
            </strong>
            <span className="text-xs text-muted">IMC</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-foreground">
              {atual.idade_metabolica ?? '—'}
            </strong>
            <span className="text-xs text-muted">idade metabólica</span>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <strong className="block text-lg text-foreground">
              {atual.densidade_ossea ?? '—'}
            </strong>
            <span className="text-xs text-muted">densidade óssea (kg)</span>
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
        <div className="mt-3 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
          Ainda não há avaliações registadas para {cliente.nome}.
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {lista.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3"
          >
            <span className="w-20 text-xs text-zinc-500">{fmt(a.data)}</span>
            <span className="flex-1 text-xs text-muted">
              {a.peso_kg ? `${a.peso_kg} kg` : '—'}
              {a.massa_gorda_pct ? ` · ${a.massa_gorda_pct}% gordura` : ''}
              {a.pt ? ` · ${a.pt.nome}` : ''}
            </span>
            <Link
              href={`/painel/${slug}/avaliacoes/${clienteId}/${a.id}/editar`}
              className="text-xs font-medium text-muted underline"
            >
              Editar
            </Link>
            <ApagarComConfirmacao
              action={apagarAvaliacao}
              confirmacao={`Tens a certeza que queres apagar a avaliação de ${fmt(a.data)}? Esta ação não pode ser desfeita.`}
              campos={{ estudio_slug: slug, cliente_id: clienteId, id: a.id }}
              className="text-lg text-zinc-400 hover:text-red-600"
              ariaLabel="Apagar"
            >
              ×
            </ApagarComConfirmacao>
          </div>
        ))}
      </div>
    </div>
  )
}
