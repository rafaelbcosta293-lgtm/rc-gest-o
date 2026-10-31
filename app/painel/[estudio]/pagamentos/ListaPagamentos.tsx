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

function LinhaPagamento({
  slug,
  linha,
  primeira,
}: {
  slug: string
  linha: LinhaPagamentoAtraso
  primeira: boolean
}) {
  const atrasado = linha.variante === 'atrasado'
  return (
    <Link
      href={`/painel/${slug}/pagamentos/${linha.clienteId}`}
      className={`flex flex-col gap-1.5 px-4 py-3.5 text-sm ${
        atrasado ? 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/40 dark:hover:bg-red-950/70' : 'bg-surface hover:bg-brand/[.06]'
      } ${primeira ? '' : atrasado ? 'border-t border-red-200 dark:border-red-900' : 'border-t border-border-subtle'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-foreground">{linha.nome}</span>
        <span
          className={`text-xs font-semibold ${
            atrasado ? 'text-red-700 dark:text-red-300' : 'text-teal-700 dark:text-teal-400'
          }`}
        >
          {linha.situacaoLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
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
        className="mt-6 w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900"
      />

      {atrasadosFiltrados.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-red-600">
            Por regularizar ({atrasadosFiltrados.length})
          </h2>
          <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-red-200 shadow-card dark:border-red-900">
            {atrasadosFiltrados.map((l, i) => (
              <LinhaPagamento key={l.clienteId} slug={slug} linha={l} primeira={i === 0} />
            ))}
          </div>
        </>
      )}

      {segurosFiltrados.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-amber-600">
            Seguro a renovar ({segurosFiltrados.length})
          </h2>
          <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-amber-200 shadow-card dark:border-amber-900">
            {segurosFiltrados.map((l, i) => (
              <Link
                key={`seguro-${l.clienteId}`}
                href={`/painel/${slug}/pagamentos/${l.clienteId}`}
                className={`flex items-center justify-between gap-3 bg-amber-50 px-4 py-3.5 text-sm hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 ${
                  i === 0 ? '' : 'border-t border-amber-200 dark:border-amber-900'
                }`}
              >
                <span className="font-medium text-foreground">{l.nome}</span>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {l.emDividaDesdeLabel}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {emDiaFiltrados.length > 0 && (
        <>
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Em dia ({emDiaFiltrados.length})
          </h2>
          <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-teal-200 shadow-card dark:border-teal-900">
            {emDiaFiltrados.map((l, i) => (
              <LinhaPagamento key={l.clienteId} slug={slug} linha={l} primeira={i === 0} />
            ))}
          </div>
        </>
      )}

      {semResultados && (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          {filtro
            ? 'Nenhum cliente com esse nome.'
            : 'Ainda não há clientes ativos neste estúdio.'}
        </div>
      )}
    </>
  )
}
