'use client'

import { useState } from 'react'

export type CategoriaOpcao = { nome: string; subs: string[] }

// Categoria + subcategoria ligadas: a lista de subcategorias muda com a
// categoria escolhida. Os valores iniciais entram sempre na lista, mesmo
// que entretanto tenham sido desativados (para editar despesas antigas).
export default function CamposCategoria({
  categorias,
  categoriaInicial = '',
  subcategoriaInicial = '',
  className,
}: {
  categorias: CategoriaOpcao[]
  categoriaInicial?: string
  subcategoriaInicial?: string
  className: string
}) {
  const [categoria, setCategoria] = useState(categoriaInicial)
  const [sub, setSub] = useState(subcategoriaInicial)

  const nomes = categorias.map((c) => c.nome)
  if (categoriaInicial && !nomes.includes(categoriaInicial)) nomes.push(categoriaInicial)
  const subs = [...(categorias.find((c) => c.nome === categoria)?.subs ?? [])]
  if (sub && !subs.includes(sub)) subs.push(sub)

  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Categoria
        <select
          name="categoria"
          required
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value)
            setSub('')
          }}
          className={className}
        >
          <option value="">Escolher…</option>
          {nomes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Subcategoria
        <select name="subcategoria" value={sub} onChange={(e) => setSub(e.target.value)} className={className}>
          <option value="">— sem subcategoria —</option>
          {subs.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
