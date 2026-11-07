'use client'

import { useMemo, useState } from 'react'
import { fmt } from '@/lib/data/presencas'
import { corEstudio } from '@/lib/data/constantes'
import { normalizarTexto } from '@/lib/texto'

export type LinhaPagamentoMes = {
  id: string
  nome: string
  dataPagamento: string
  metodo: string | null
  valor: number
  plano: string | null
  estudioNome: string | null
  estudioSlug: string | null
}

function fmtEuro(v: number) {
  return `€${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function contarPor<T>(linhas: T[], chaveDe: (l: T) => string): [string, number][] {
  const mapa = new Map<string, number>()
  for (const l of linhas) {
    const chave = chaveDe(l)
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1)
  }
  return [...mapa.entries()].sort((a, b) => b[1] - a[1])
}

type Campo = 'data' | 'nome'
type Direcao = 'asc' | 'desc'

export default function ListaPagamentosMes({
  linhas,
  mostrarEstudio,
}: {
  linhas: LinhaPagamentoMes[]
  mostrarEstudio: boolean
}) {
  const [filtro, setFiltro] = useState('')
  const [campo, setCampo] = useState<Campo>('data')
  const [direcao, setDirecao] = useState<Direcao>('desc')

  const linhasFiltradas = useMemo(() => {
    const alvo = filtro ? normalizarTexto(filtro) : null
    const filtradas = alvo ? linhas.filter((l) => normalizarTexto(l.nome).includes(alvo)) : linhas
    return [...filtradas].sort((a, b) => {
      const cmp =
        campo === 'nome'
          ? normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome))
          : a.dataPagamento.localeCompare(b.dataPagamento)
      return direcao === 'asc' ? cmp : -cmp
    })
  }, [linhas, filtro, campo, direcao])

  // Resumo do mês: sempre sobre o que está filtrado (procurar por um
  // nome também restringe o resumo a essa pessoa) — não sobre a lista
  // completa do mês.
  const total = linhasFiltradas.reduce((soma, l) => soma + l.valor, 0)

  const porMetodo = contarPor(linhasFiltradas, (l) => l.metodo ?? 'Sem método')
  const porPlano = contarPor(linhasFiltradas, (l) => l.plano ?? 'Sem plano')

  function mudarCampo(novoCampo: Campo) {
    setCampo(novoCampo)
    setDirecao(novoCampo === 'nome' ? 'asc' : 'desc')
  }

  return (
    <div className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Resumo do mês</h2>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Total recebido</h3>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">{fmtEuro(total)}</p>
          <p className="mt-1 text-xs text-muted">
            {linhasFiltradas.length} {linhasFiltradas.length === 1 ? 'pagamento' : 'pagamentos'}
          </p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Por método</h3>
          <div className="mt-2 flex flex-col gap-1 text-sm">
            {porMetodo.length === 0 ? (
              <span className="text-xs text-muted">—</span>
            ) : (
              porMetodo.map(([metodo, n]) => (
                <div key={metodo} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{metodo}</span>
                  <span className="font-mono text-xs font-semibold text-muted">{n}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Por plano</h3>
          <div className="mt-2 flex flex-col gap-1 text-sm">
            {porPlano.length === 0 ? (
              <span className="text-xs text-muted">—</span>
            ) : (
              porPlano.map(([plano, n]) => (
                <div key={plano} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{plano}</span>
                  <span className="font-mono text-xs font-semibold text-muted">{n}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Procurar por nome…"
          className="flex-1 basis-60 rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900"
        />
        <select
          value={campo}
          onChange={(e) => mudarCampo(e.target.value as Campo)}
          className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm outline-none"
        >
          <option value="data">Ordenar por data</option>
          <option value="nome">Ordenar por nome</option>
        </select>
        <button
          type="button"
          onClick={() => setDirecao(direcao === 'asc' ? 'desc' : 'asc')}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm text-muted transition-colors hover:border-border-strong hover:bg-brand/[.06]"
        >
          {campo === 'nome'
            ? direcao === 'asc'
              ? 'A → Z'
              : 'Z → A'
            : direcao === 'desc'
              ? 'Mais recentes'
              : 'Mais antigos'}
        </button>
      </div>

      {linhasFiltradas.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          {filtro ? 'Nenhum pagamento com esse nome.' : 'Sem pagamentos registados neste mês.'}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border-subtle shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-border-subtle/40 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Método</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((l, i) => (
                <tr key={l.id} className={`bg-surface ${i === 0 ? '' : 'border-t border-border-subtle'}`}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {l.nome}
                    {mostrarEstudio && l.estudioNome && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: l.estudioSlug ? corEstudio(l.estudioSlug).cor : undefined }}
                        />
                        {l.estudioNome}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left text-muted">{fmt(l.dataPagamento)}</td>
                  <td className="px-4 py-3 text-left text-muted">{l.metodo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                    {fmtEuro(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
