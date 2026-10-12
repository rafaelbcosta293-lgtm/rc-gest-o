'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { iniciais } from '@/lib/data/presencas'
import { normalizarTexto } from '@/lib/texto'
import AnelProgresso from '@/components/AnelProgresso'

export type LinhaPresenca = {
  id: string
  nome: string
  frequenciaSemanal: number | null
  feitos: number
  faltas: number
  avisadas: number
  alvo: number | null
  pct: number | null
  corBg: string
  corTx: string
}

export default function ListaPresencas({
  linhas,
  slug,
  ano,
  mes,
}: {
  linhas: LinhaPresenca[]
  slug: string
  ano: number
  mes: number
}) {
  const [filtro, setFiltro] = useState('')

  const linhasFiltradas = useMemo(() => {
    if (!filtro) return linhas
    const alvo = normalizarTexto(filtro)
    return linhas.filter((l) => normalizarTexto(l.nome).includes(alvo))
  }, [linhas, filtro])

  return (
    <>
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Procurar por nome…"
        className="mt-4 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
      />

      <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {linhasFiltradas.map((l, indice) => (
          <Link
            key={l.id}
            href={`/painel/${slug}/presencas/${l.id}?ano=${ano}&mes=${mes}`}
            className={`flex items-center gap-4 bg-white px-4 py-3 transition-colors hover:bg-black/[.02] dark:bg-zinc-950 dark:hover:bg-white/[.05] ${
              indice > 0 ? 'border-t border-black/10 dark:border-white/10' : ''
            }`}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={{ background: l.corBg, color: l.corTx }}
            >
              {iniciais(l.nome)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2">
                <strong className="truncate text-sm text-black dark:text-zinc-50">
                  {l.nome}
                </strong>
                <span className="shrink-0 text-xs text-zinc-500">
                  {l.frequenciaSemanal ? `${l.frequenciaSemanal}×/semana` : 'sem frequência'}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {l.feitos}{l.alvo != null ? ` de ${l.alvo}` : ''} treinos
                </span>
                {l.faltas > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                    {l.faltas} faltas
                  </span>
                )}
                {l.avisadas > 0 && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {l.avisadas} avisadas
                  </span>
                )}
              </div>
            </div>
            {l.alvo != null && (
              <AnelProgresso
                percent={l.pct ?? 0}
                color={(l.pct ?? 0) >= 100 ? '#1E7145' : '#0E9594'}
              >
                <span className="text-xs font-semibold text-black dark:text-zinc-50">
                  {l.pct}%
                </span>
              </AnelProgresso>
            )}
          </Link>
        ))}
      </div>

      {linhasFiltradas.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {filtro ? 'Nenhum cliente ativo com esse nome.' : 'Ainda não há clientes ativos neste estúdio.'}
        </div>
      )}
    </>
  )
}
