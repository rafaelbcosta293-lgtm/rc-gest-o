'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { normalizarTexto } from '@/lib/texto'

export type LinhaTreino = {
  id: string
  nome: string
  objetivo: string | null
  alertaLabel: string | null
  alertaBg: string
  alertaTx: string
  alertaDot: string
  ultimoTreinoLabel: string
}

export default function ListaTreinos({ linhas, slug }: { linhas: LinhaTreino[]; slug: string }) {
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
        placeholder="Procurar cliente…"
        className="mt-6 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
      />

      <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {linhasFiltradas.map((l, i) => (
          <Link
            key={l.id}
            href={`/painel/${slug}/treinos/${l.id}`}
            className={`flex flex-col gap-1.5 bg-white px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:bg-zinc-950 dark:hover:bg-white/[.05] ${
              i > 0 ? 'border-t border-black/10 dark:border-white/10' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="flex min-w-[160px] flex-1 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.alertaDot }} />
                <span className="truncate font-medium text-black dark:text-zinc-50">
                  {l.nome}
                </span>
              </span>
              {l.alertaLabel && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: l.alertaBg, color: l.alertaTx }}
                >
                  {l.alertaLabel}
                </span>
              )}
              <span className="shrink-0 text-xs text-zinc-500">{l.ultimoTreinoLabel}</span>
            </div>
            {l.objetivo && <p className="text-xs text-zinc-500">{l.objetivo}</p>}
          </Link>
        ))}
      </div>

      {linhasFiltradas.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {filtro ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes neste estúdio.'}
        </div>
      )}
    </>
  )
}
