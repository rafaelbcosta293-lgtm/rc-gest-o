'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { normalizarTexto } from '@/lib/texto'

export type LinhaPagamentoAtraso = {
  clienteId: string
  nome: string
  variante: 'atrasado' | 'emDia'
  situacaoLabel: string
  tipoMensalidade: string | null
  realizados: number
  adquiridos: number | null
}

export type LinhaSeguro = {
  clienteId: string
  nome: string
  emDividaDesdeLabel: string
}

function CartaoPagamento({ slug, linha }: { slug: string; linha: LinhaPagamentoAtraso }) {
  const cores =
    linha.variante === 'atrasado'
      ? 'border-red-200 bg-red-50 hover:border-red-300 dark:border-red-900 dark:bg-red-950'
      : 'border-black/10 bg-white hover:border-black/30 dark:border-white/10 dark:bg-zinc-950'
  return (
    <Link
      href={`/painel/${slug}/pagamentos/${linha.clienteId}`}
      className={`flex flex-col gap-1.5 rounded-xl border p-4 transition-colors ${cores}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-black dark:text-zinc-50">{linha.nome}</span>
        <span
          className={`text-xs font-medium ${
            linha.variante === 'atrasado' ? 'text-red-700 dark:text-red-300' : 'text-teal-700 dark:text-teal-400'
          }`}
        >
          {linha.situacaoLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span>{linha.tipoMensalidade ?? 'sem plano associado'}</span>
        {linha.adquiridos != null && (
          <span>
            · {linha.realizados} de {linha.adquiridos} treinos
          </span>
        )}
      </div>
    </Link>
  )
}

export default function ListaPagamentos({
  slug,
  atrasados,
  emDia,
  segurosARenovar,
}: {
  slug: string
  atrasados: LinhaPagamentoAtraso[]
  emDia: LinhaPagamentoAtraso[]
  segurosARenovar: LinhaSeguro[]
}) {
  const [filtro, setFiltro] = useState('')

  const { atrasadosFiltrados, emDiaFiltrados, segurosFiltrados } = useMemo(() => {
    if (!filtro) {
      return { atrasadosFiltrados: atrasados, emDiaFiltrados: emDia, segurosFiltrados: segurosARenovar }
    }
    const alvo = normalizarTexto(filtro)
    return {
      atrasadosFiltrados: atrasados.filter((l) => normalizarTexto(l.nome).includes(alvo)),
      emDiaFiltrados: emDia.filter((l) => normalizarTexto(l.nome).includes(alvo)),
      segurosFiltrados: segurosARenovar.filter((l) => normalizarTexto(l.nome).includes(alvo)),
    }
  }, [atrasados, emDia, segurosARenovar, filtro])

  const semResultados =
    atrasadosFiltrados.length === 0 && emDiaFiltrados.length === 0 && segurosFiltrados.length === 0

  return (
    <>
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Procurar por nome…"
        className="mt-6 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
      />

      {atrasadosFiltrados.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-red-600">
            Por regularizar ({atrasadosFiltrados.length})
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {atrasadosFiltrados.map((l) => (
              <CartaoPagamento key={l.clienteId} slug={slug} linha={l} />
            ))}
          </div>
        </>
      )}

      {segurosFiltrados.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-amber-600">
            Seguro a renovar ({segurosFiltrados.length})
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {segurosFiltrados.map((l) => (
              <Link
                key={`seguro-${l.clienteId}`}
                href={`/painel/${slug}/pagamentos/${l.clienteId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
              >
                <span className="font-medium text-black dark:text-zinc-50">{l.nome}</span>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {l.emDividaDesdeLabel}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {emDiaFiltrados.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Em dia ({emDiaFiltrados.length})
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {emDiaFiltrados.map((l) => (
              <CartaoPagamento key={l.clienteId} slug={slug} linha={l} />
            ))}
          </div>
        </>
      )}

      {semResultados && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {filtro
            ? 'Nenhum cliente com esse nome.'
            : 'Ainda não há clientes ativos neste estúdio.'}
        </div>
      )}
    </>
  )
}
