'use client'

import { useState, useTransition } from 'react'
import type { CatalogoExercicios, ItemCatalogo } from '@/lib/data/catalogo'
import { criarExercicioRapido } from './actions'

export default function ExercicioPicker({
  aberto,
  fechar,
  escolher,
  criado,
  catalogo,
}: {
  aberto: boolean
  fechar: () => void
  escolher: (item: ItemCatalogo) => void
  criado: (item: ItemCatalogo, categoriaId: string | null) => void
  catalogo: CatalogoExercicios
}) {
  const [catId, setCatId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [erroNovo, setErroNovo] = useState<string | null>(null)
  const [aGuardar, iniciarGuardar] = useTransition()

  if (!aberto) return null

  const jaExiste = (nome: string) =>
    catalogo.todos.some((e) => e.nome.toLowerCase() === nome.trim().toLowerCase())

  const adicionarNovo = () => {
    const nome = novoNome.trim()
    if (!nome) return
    const existente = catalogo.todos.find((e) => e.nome.toLowerCase() === nome.toLowerCase())
    if (existente) {
      escolher(existente)
      fechar()
      return
    }
    setErroNovo(null)
    iniciarGuardar(async () => {
      const resultado = await criarExercicioRapido(nome, catId)
      if ('error' in resultado) {
        setErroNovo(resultado.error)
        return
      }
      criado(resultado.exercicio, catId)
      escolher(resultado.exercicio)
      setNovoNome('')
      fechar()
    })
  }

  const lista: ItemCatalogo[] = q.trim()
    ? catalogo.todos.filter((e) => e.nome.toLowerCase().includes(q.toLowerCase()))
    : catId
      ? (catalogo.porCategoria[catId] ?? [])
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

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-teal-400 bg-teal-50 p-2.5 dark:bg-teal-950">
          <input
            value={novoNome}
            onChange={(e) => {
              setNovoNome(e.target.value)
              setErroNovo(null)
            }}
            placeholder="Não está na lista? Escreve o nome do exercício novo…"
            className="min-w-[180px] flex-1 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
          <button
            type="button"
            disabled={!novoNome.trim() || aGuardar}
            onClick={adicionarNovo}
            className="shrink-0 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {aGuardar
              ? 'A adicionar…'
              : jaExiste(novoNome)
                ? 'Escolher'
                : '+ Adicionar à lista'}
          </button>
        </div>
        {erroNovo && <p className="mt-1 text-xs text-red-600">{erroNovo}</p>}

        {!q.trim() && (
          <>
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Grupos musculares
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {catalogo.categorias
                .filter((c) => c.parte === 'A')
                .map((c) => (
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
              {catalogo.categorias
                .filter((c) => c.parte === 'B')
                .map((c) => (
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
              key={e.id}
              type="button"
              onClick={() => {
                escolher(e)
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
