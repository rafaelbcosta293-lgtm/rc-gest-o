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
  dataReferencia: string | null
}

export type LinhaSeguro = {
  clienteId: string
  nome: string
  emDividaDesdeLabel: string
  dataReferencia: string
}

type Ordem = 'recente' | 'antigo'

// Quem não tem data (nunca pagou) fica sempre no fim, seja qual for a
// ordem escolhida — não há "mais recente"/"mais antigo" para comparar.
function ordenarPorData<T extends { dataReferencia: string | null }>(linhas: T[], ordem: Ordem): T[] {
  return [...linhas].sort((a, b) => {
    if (!a.dataReferencia && !b.dataReferencia) return 0
    if (!a.dataReferencia) return 1
    if (!b.dataReferencia) return -1
    return ordem === 'recente'
      ? b.dataReferencia.localeCompare(a.dataReferencia)
      : a.dataReferencia.localeCompare(b.dataReferencia)
  })
}

function BotaoOrdem({ ordem, onChange }: { ordem: Ordem; onChange: (o: Ordem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(ordem === 'recente' ? 'antigo' : 'recente')}
      className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted transition-colors hover:border-border-strong hover:bg-brand/[.06]"
      title="Mudar a ordem desta coluna"
    >
      {ordem === 'recente' ? 'Mais recentes' : 'Mais antigos'}
    </button>
  )
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
  const [ordemAtrasados, setOrdemAtrasados] = useState<Ordem>('recente')
  const [ordemSeguros, setOrdemSeguros] = useState<Ordem>('recente')
  const [ordemEmDia, setOrdemEmDia] = useState<Ordem>('recente')

  const { atrasadosFiltrados, emDiaFiltrados, segurosFiltrados } = useMemo(() => {
    const alvo = filtro ? normalizarTexto(filtro) : null
    const porNome = <T extends { nome: string }>(lista: T[]) =>
      alvo ? lista.filter((l) => normalizarTexto(l.nome).includes(alvo)) : lista

    return {
      atrasadosFiltrados: ordenarPorData(porNome(atrasados), ordemAtrasados),
      emDiaFiltrados: ordenarPorData(porNome(emDia), ordemEmDia),
      segurosFiltrados: ordenarPorData(porNome(segurosARenovar), ordemSeguros),
    }
  }, [atrasados, emDia, segurosARenovar, filtro, ordemAtrasados, ordemSeguros, ordemEmDia])

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

      {semResultados ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          {filtro ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes neste estúdio.'}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Por regularizar ({atrasadosFiltrados.length})
              </h2>
              {atrasadosFiltrados.length > 1 && (
                <BotaoOrdem ordem={ordemAtrasados} onChange={setOrdemAtrasados} />
              )}
            </div>
            {atrasadosFiltrados.length > 0 ? (
              <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-red-200 shadow-card dark:border-red-900">
                {atrasadosFiltrados.map((l, i) => (
                  <LinhaPagamento key={l.clienteId} slug={slug} linha={l} primeira={i === 0} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém por regularizar.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Seguro a renovar ({segurosFiltrados.length})
              </h2>
              {segurosFiltrados.length > 1 && <BotaoOrdem ordem={ordemSeguros} onChange={setOrdemSeguros} />}
            </div>
            {segurosFiltrados.length > 0 ? (
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
            ) : (
              <p className="mt-2 text-sm text-muted">Nenhum seguro a renovar.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Em dia ({emDiaFiltrados.length})
              </h2>
              {emDiaFiltrados.length > 1 && <BotaoOrdem ordem={ordemEmDia} onChange={setOrdemEmDia} />}
            </div>
            {emDiaFiltrados.length > 0 ? (
              <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-teal-200 shadow-card dark:border-teal-900">
                {emDiaFiltrados.map((l, i) => (
                  <LinhaPagamento key={l.clienteId} slug={slug} linha={l} primeira={i === 0} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém em dia.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
