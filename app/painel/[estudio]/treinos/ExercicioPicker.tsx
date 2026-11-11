'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import type { CatalogoExercicios, ItemCatalogo } from '@/lib/data/catalogo'
import { criarExercicioRapido } from './actions'

export default function ExercicioPicker({
  aberto,
  fechar,
  escolher,
  criado,
  catalogo,
  maisUsados = [],
}: {
  aberto: boolean
  fechar: () => void
  escolher: (item: ItemCatalogo) => void
  criado: (item: ItemCatalogo, categoriaId: string | null) => void
  catalogo: CatalogoExercicios
  maisUsados?: ItemCatalogo[]
}) {
  const [catId, setCatId] = useState<string | null>(null)
  const [grupo, setGrupo] = useState<'A' | 'B'>('A')
  const [q, setQ] = useState('')
  const [erroNovo, setErroNovo] = useState<string | null>(null)
  const [aGuardar, iniciarGuardar] = useTransition()

  if (!aberto) return null

  const jaExiste = (nome: string) =>
    catalogo.todos.some((e) => e.nome.toLowerCase() === nome.trim().toLowerCase())

  // A pesquisa serve também para criar — não há um segundo campo "nome
  // do exercício novo" à parte: o que se escreveu para procurar passa a
  // ser o nome, se não existir já nenhum exercício igual.
  const adicionarNovo = () => {
    const nome = q.trim()
    if (!nome || jaExiste(nome)) return
    setErroNovo(null)
    iniciarGuardar(async () => {
      const resultado = await criarExercicioRapido(nome, catId)
      if ('error' in resultado) {
        setErroNovo(resultado.error)
        return
      }
      criado(resultado.exercicio, catId)
      escolher(resultado.exercicio)
      setQ('')
      fechar()
    })
  }

  const emPesquisa = q.trim() !== ''
  const lista: ItemCatalogo[] = emPesquisa
    ? catalogo.todos.filter((e) => e.nome.toLowerCase().includes(q.toLowerCase()))
    : catId
      ? (catalogo.porCategoria[catId] ?? [])
      : []

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={fechar}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-zinc-50 p-4 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <strong className="text-foreground">Escolher exercício</strong>
          <button
            type="button"
            onClick={fechar}
            className="rounded-full p-1 text-zinc-500 hover:bg-black/[.06] dark:hover:bg-white/[.08]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setErroNovo(null)
          }}
          placeholder="Pesquisar, ou escrever o nome de um exercício novo…"
          className="mt-4 w-full rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-800"
        />

        {!emPesquisa && (
          <>
            {maisUsados.length > 0 && (
              <>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Mais usados com este cliente
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {maisUsados.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        escolher(e)
                        fechar()
                      }}
                      className="truncate rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-left text-xs font-medium text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200"
                    >
                      {e.nome}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {(['A', 'B'] as const).map((parte) => (
                <button
                  key={parte}
                  type="button"
                  onClick={() => {
                    setGrupo(parte)
                    setCatId(null)
                  }}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    grupo === parte
                      ? 'bg-white text-foreground shadow-sm dark:bg-zinc-900'
                      : 'text-zinc-500'
                  }`}
                >
                  {parte === 'A' ? 'Grupos musculares' : 'Tipo de treino'}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {catalogo.categorias
                .filter((c) => c.parte === grupo)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatId(catId === c.id ? null : c.id)}
                    className={`truncate rounded-md border px-2.5 py-1.5 text-left text-xs ${
                      catId === c.id
                        ? 'border-brand bg-brand text-black'
                        : 'border-border-subtle bg-white dark:bg-zinc-800'
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
            <p className="py-4 text-center text-sm text-zinc-500">
              {emPesquisa ? 'Nenhum exercício com esse nome.' : 'Escolhe uma categoria acima ou pesquisa pelo nome.'}
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
              className="rounded-md border border-border-subtle bg-white px-3 py-2.5 text-left text-sm hover:border-teal-500 hover:bg-teal-50 dark:bg-zinc-800 dark:hover:bg-teal-950"
            >
              {e.nome}
            </button>
          ))}

          {/* Só aparece quando faz sentido: a pesquisar e sem já existir
              um exercício exatamente com este nome — em vez de uma
              caixa "criar novo" sempre visível, mesmo a navegar por
              categoria. */}
          {emPesquisa && !jaExiste(q) && (
            <button
              type="button"
              disabled={aGuardar}
              onClick={adicionarNovo}
              className="rounded-md border border-dashed border-teal-400 bg-teal-50 px-3 py-2.5 text-left text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200"
            >
              {aGuardar ? 'A adicionar…' : `+ Criar "${q.trim()}"`}
            </button>
          )}
          {erroNovo && <p className="text-xs text-red-600">{erroNovo}</p>}
        </div>
      </div>
    </div>
  )
}
