'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { normalizarTexto } from '@/lib/texto'

export type LinhaCliente = {
  id: string
  numeroSocio: string | null
  nome: string
  telefone: string | null
  estadoLabel: string
  estadoBg: string
  estadoTx: string
  alertaDot: string
  inscricaoLabel: string
  pagamentoLabel: string
  pagamentoEmDia: boolean | null
  treinosLabel: string
  aniversarioLabel: string | null
}

export default function ListaClientes({ linhas, slug }: { linhas: LinhaCliente[]; slug: string }) {
  const [filtro, setFiltro] = useState('')

  const linhasFiltradas = useMemo(() => {
    if (!filtro) return linhas
    const alvo = normalizarTexto(filtro)
    return linhas.filter(
      (l) =>
        normalizarTexto(l.nome).includes(alvo) ||
        (l.numeroSocio && normalizarTexto(l.numeroSocio).includes(alvo))
    )
  }, [linhas, filtro])

  return (
    <>
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Procurar por nome ou nº de sócio…"
        className="mt-4 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
      />

      <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {linhasFiltradas.map((l, i) => (
          <Link
            key={l.id}
            href={`/painel/${slug}/clientes/${l.id}`}
            className={`flex flex-col gap-1.5 bg-white px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:bg-zinc-950 dark:hover:bg-white/[.05] ${
              i > 0 ? 'border-t border-black/10 dark:border-white/10' : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="w-16 shrink-0 font-mono text-xs text-zinc-500">
                {l.numeroSocio ?? '—'}
              </span>
              <span className="flex min-w-[160px] flex-1 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.alertaDot }} />
                <span className="truncate font-medium text-black dark:text-zinc-50">{l.nome}</span>
              </span>
              <span
                className="w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium"
                style={{ background: l.estadoBg, color: l.estadoTx }}
              >
                {l.estadoLabel}
              </span>
              <span className="w-32 shrink-0 text-xs text-zinc-500">
                {l.telefone ?? 'sem contacto'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span className="w-44 shrink-0">{l.inscricaoLabel}</span>
              <span className="w-36 shrink-0">
                {l.pagamentoEmDia === null ? (
                  l.pagamentoLabel
                ) : (
                  <span className={l.pagamentoEmDia ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'}>
                    {l.pagamentoLabel}
                  </span>
                )}
              </span>
              <span className="w-32 shrink-0">{l.treinosLabel}</span>
              <span className="w-40 shrink-0">{l.aniversarioLabel}</span>
            </div>
          </Link>
        ))}
      </div>

      {linhasFiltradas.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {filtro ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes com este filtro.'}
        </div>
      )}
    </>
  )
}
