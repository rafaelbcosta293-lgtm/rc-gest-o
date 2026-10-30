'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { normalizarTexto } from '@/lib/texto'
import EditarClienteModal, { type ClienteEdicao } from './EditarClienteModal'
import type { EstadoCliente } from '@/lib/supabase/database.types'

export type LinhaCliente = {
  id: string
  numeroSocio: string | null
  nome: string
  telefone: string | null
  email: string | null
  nascimento: string | null
  frequenciaSemanal: number | null
  estado: EstadoCliente
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
  const [editando, setEditando] = useState<ClienteEdicao | null>(null)

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
      <div className="relative mt-4">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Procurar por nome ou nº de sócio…"
          className="w-full rounded-2xl border border-border-subtle bg-surface py-3 pl-10 pr-3.5 text-sm outline-none transition-colors focus:border-brand/60"
        />
      </div>

      <div className="mt-4 flex flex-col overflow-hidden rounded-2xl border border-border-subtle shadow-card">
        {linhasFiltradas.map((l, i) => (
          <Link
            key={l.id}
            href={`/painel/${slug}/clientes/${l.id}`}
            className={`flex flex-col gap-1.5 bg-surface px-4 py-3.5 text-sm transition-colors hover:bg-brand/[.06] ${
              i > 0 ? 'border-t border-border-subtle' : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="w-16 shrink-0 font-mono text-xs text-muted">
                {l.numeroSocio ?? '—'}
              </span>
              <span className="flex min-w-[160px] flex-1 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.alertaDot }} />
                <span
                  className="truncate font-semibold text-foreground"
                  title="Botão direito para editar"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setEditando({
                      id: l.id,
                      nome: l.nome,
                      numeroSocio: l.numeroSocio,
                      telefone: l.telefone,
                      email: l.email,
                      nascimento: l.nascimento,
                      frequenciaSemanal: l.frequenciaSemanal,
                      estado: l.estado,
                    })
                  }}
                >
                  {l.nome}
                </span>
              </span>
              <span
                className="w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium"
                style={{ background: l.estadoBg, color: l.estadoTx }}
              >
                {l.estadoLabel}
              </span>
              <span className="w-32 shrink-0 text-xs text-muted">
                {l.telefone ?? 'sem contacto'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
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
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          {filtro ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes com este filtro.'}
        </div>
      )}

      {editando && (
        <EditarClienteModal slug={slug} cliente={editando} onFechar={() => setEditando(null)} />
      )}
    </>
  )
}
