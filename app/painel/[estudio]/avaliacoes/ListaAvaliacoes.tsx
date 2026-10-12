'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { normalizarTexto } from '@/lib/texto'

export type LinhaAvaliacao = {
  id: string
  nome: string
  reavaliacaoAtrasada: boolean
  ultimaData: string | null
  pesoKg: number | null
  imc: number | null
  massaGordaPct: number | null
}

export default function ListaAvaliacoes({
  linhas,
  slug,
}: {
  linhas: LinhaAvaliacao[]
  slug: string
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

      <div className="mt-4 flex flex-col gap-2">
        {linhasFiltradas.map((l) => (
          <Link
            key={l.id}
            href={`/painel/${slug}/avaliacoes/${l.id}`}
            className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-black dark:text-zinc-50">{l.nome}</span>
              <div className="flex items-center gap-2">
                {l.reavaliacaoAtrasada && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    Reavaliação prevista
                  </span>
                )}
                <span className="text-xs text-zinc-500">
                  {l.ultimaData ? `última em ${l.ultimaData}` : 'sem avaliações'}
                </span>
              </div>
            </div>
            {l.ultimaData && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                <span>{l.pesoKg != null ? `${l.pesoKg} kg` : 'sem peso'}</span>
                {l.imc != null && <span>· IMC {l.imc}</span>}
                {l.massaGordaPct != null && <span>· {l.massaGordaPct}% gordura</span>}
              </div>
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
