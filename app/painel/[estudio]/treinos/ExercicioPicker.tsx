'use client'

import { useState } from 'react'
import { CATEGORIAS, TODOS_EX } from '@/lib/data/exercicios'

export default function ExercicioPicker({
  aberto,
  fechar,
  escolher,
}: {
  aberto: boolean
  fechar: () => void
  escolher: (nome: string) => void
}) {
  const [catId, setCatId] = useState<number | null>(null)
  const [q, setQ] = useState('')

  if (!aberto) return null

  const lista = q.trim()
    ? TODOS_EX.filter((e) => e.nome.toLowerCase().includes(q.toLowerCase()))
    : catId
      ? (CATEGORIAS.find((c) => c.id === catId)?.ex ?? []).map((nome) => ({ nome }))
      : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={fechar}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-zinc-50 p-4 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <strong className="text-black dark:text-zinc-50">Escolher exercício</strong>
          <button
            type="button"
            onClick={fechar}
            className="text-2xl leading-none text-zinc-500"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar em todos os exercícios…"
          className="mt-4 w-full rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-800"
        />

        {!q.trim() && (
          <>
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Grupos musculares
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORIAS.filter((c) => c.parte === 'A').map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatId(catId === c.id ? null : c.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    catId === c.id
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-800'
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </div>
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Tipo de treino
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORIAS.filter((c) => c.parte === 'B').map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatId(catId === c.id ? null : c.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    catId === c.id
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-800'
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 flex flex-col gap-1">
          {lista.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-500">
              {q.trim()
                ? 'Nenhum exercício com esse nome.'
                : 'Escolhe uma categoria acima ou pesquisa pelo nome.'}
            </p>
          )}
          {lista.map((e) => (
            <button
              key={e.nome}
              type="button"
              onClick={() => {
                escolher(e.nome)
                fechar()
              }}
              className="rounded-md border border-black/10 bg-white px-3 py-2.5 text-left text-sm hover:border-teal-500 hover:bg-teal-50 dark:border-white/10 dark:bg-zinc-800 dark:hover:bg-teal-950"
            >
              {e.nome}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
