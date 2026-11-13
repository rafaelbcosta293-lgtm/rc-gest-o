'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { fmt } from '@/lib/data/presencas'
import { corTipoEvento, rotuloTipoEvento } from '@/lib/data/agenda'
import { pesquisarAgenda, type ResultadoPesquisaAgenda } from './actions'

// Pesquisa global na agenda (nome do cliente, do instrutor, título ou
// nota) — não se limita ao dia/semana/mês visível, por isso cada
// resultado salta para o dia exato desse evento. Pedido do dono: "por
// exemplo, pesquisar o nome de um cliente e aparecerem todos os
// eventos desse cliente na agenda".
export default function BuscaAgenda({ estudioId, basePath }: { estudioId: number; basePath: string }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<ResultadoPesquisaAgenda[]>([])
  const [aPesquisar, setAPesquisar] = useState(false)
  const [aberto, setAberto] = useState(false)
  const caixaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const curto = texto.trim().length < 2
    const temporizador = setTimeout(
      () => {
        if (curto) {
          setResultados([])
          setAPesquisar(false)
          return
        }
        setAPesquisar(true)
        pesquisarAgenda(estudioId, texto)
          .then((r) => setResultados(r))
          .finally(() => setAPesquisar(false))
      },
      curto ? 0 : 300
    )
    return () => clearTimeout(temporizador)
  }, [texto, estudioId])

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  return (
    <div ref={caixaRef} className="relative w-full min-w-[180px] sm:w-64">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
        <Search className="h-3.5 w-3.5" />
      </span>
      <input
        type="text"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setTexto('')
            setAberto(false)
          }
        }}
        placeholder="Pesquisar na agenda…"
        className="w-full rounded-full border border-border-subtle bg-surface py-1.5 pl-8 pr-7 text-xs outline-none transition-colors focus:border-brand/60"
      />
      {texto && (
        <button
          type="button"
          onClick={() => {
            setTexto('')
            setAberto(false)
          }}
          className="absolute inset-y-0 right-2 flex items-center text-muted hover:text-foreground"
          aria-label="Limpar pesquisa"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {aberto && texto.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-border-subtle bg-surface shadow-card sm:w-[22rem]">
          {aPesquisar ? (
            <p className="px-3 py-3 text-xs text-muted">A pesquisar…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">Sem resultados para &quot;{texto}&quot;.</p>
          ) : (
            resultados.map((r, i) => (
              <Link
                key={r.id}
                href={`${basePath}?vista=dia&data=${r.data}`}
                onClick={() => setAberto(false)}
                className={`flex flex-col gap-0.5 px-3 py-2 text-xs transition-colors hover:bg-brand/[.08] ${
                  i > 0 ? 'border-t border-border-subtle' : ''
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: corTipoEvento(r.tipo).tx }}
                  />
                  <span className="truncate font-semibold text-foreground">
                    {r.nomeCliente ?? rotuloTipoEvento(r.tipo, r.titulo)}
                  </span>
                  {r.estado !== 'Agendado' && (
                    <span className="shrink-0 text-[10px] text-muted">· {r.estado}</span>
                  )}
                </div>
                <span className="text-muted">
                  {fmt(r.data)} · {r.horaInicio.slice(0, 5)}
                  {r.nomeCliente ? ` · ${rotuloTipoEvento(r.tipo, r.titulo)}` : ''}
                  {r.nomePt ? ` · ${r.nomePt}` : ''}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
