'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ESTADOS_LEAD, PALETA } from '@/lib/data/constantes'
import { fmt } from '@/lib/data/presencas'
import { diasDesde } from '@/lib/data/leads'
import { moverEstadoLeadRapido } from './actions'
import type { Lead, TemperaturaLead } from '@/lib/supabase/database.types'

const ORDEM_FUNIL = Object.keys(ESTADOS_LEAD) as (keyof typeof ESTADOS_LEAD)[]
const TEMPERATURAS: TemperaturaLead[] = ['Fria', 'Morna', 'Quente']
const CORES_TEMPERATURA: Record<TemperaturaLead, { bg: string; tx: string }> = {
  Fria: PALETA.azul,
  Morna: PALETA.ambar,
  Quente: PALETA.vermelho,
}

// Badge da origem — só as 3 origens automáticas (webhooks) têm cor
// própria; origens manuais ("Instagram", "indicação", texto livre tal
// como sempre) ficam todas na mesma cor neutra.
const CORES_ORIGEM: Record<string, { bg: string; tx: string }> = {
  'Meta Ads': PALETA.azul,
  'Google Forms': PALETA.verde,
  Website: PALETA.ambar,
}
function corOrigem(origem: string) {
  return CORES_ORIGEM[origem] ?? PALETA.neutro
}

export type LeadResumo = Pick<
  Lead,
  | 'id'
  | 'nome'
  | 'telefone'
  | 'estado'
  | 'origem'
  | 'temperatura'
  | 'responsavel_id'
  | 'proximo_contacto'
  | 'visita_data'
  | 'visita_hora'
  | 'valor_potencial'
  | 'entrada'
> & { responsavel: { nome: string } | null }

export default function LeadsKanban({
  estudioSlug,
  leads,
  pts,
}: {
  estudioSlug: string
  leads: LeadResumo[]
  pts: { id: string; nome: string }[]
}) {
  const [busca, setBusca] = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [filtroTemperatura, setFiltroTemperatura] = useState('')
  const [dragOverEstado, setDragOverEstado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, iniciarTransicao] = useTransition()

  const origens = useMemo(
    () => Array.from(new Set(leads.map((l) => l.origem).filter((o): o is string => !!o))).sort(),
    [leads]
  )

  const hoje = new Date().toISOString().slice(0, 10)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return leads.filter((l) => {
      if (filtroResponsavel && l.responsavel_id !== filtroResponsavel) return false
      if (filtroOrigem && l.origem !== filtroOrigem) return false
      if (filtroTemperatura && (l.temperatura ?? 'Morna') !== filtroTemperatura) return false
      if (termo) {
        const alvo = `${l.nome} ${l.telefone ?? ''}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [leads, busca, filtroResponsavel, filtroOrigem, filtroTemperatura])

  const porEstado = useMemo(() => {
    const mapa = new Map<string, LeadResumo[]>()
    for (const l of filtrados) {
      const lista = mapa.get(l.estado) ?? []
      lista.push(l)
      mapa.set(l.estado, lista)
    }
    return mapa
  }, [filtrados])

  function largar(id: string, estado: string) {
    setDragOverEstado(null)
    setErro(null)
    iniciarTransicao(async () => {
      const resultado = await moverEstadoLeadRapido({ estudioSlug, id, estado })
      if ('error' in resultado) setErro(resultado.error)
    })
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar nome ou telefone…"
          className="min-w-[180px] flex-1 rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
        />
        <select
          value={filtroResponsavel}
          onChange={(e) => setFiltroResponsavel(e.target.value)}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
        >
          <option value="">Todos os responsáveis</option>
          {pts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select
          value={filtroOrigem}
          onChange={(e) => setFiltroOrigem(e.target.value)}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
        >
          <option value="">Todas as origens</option>
          {origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={filtroTemperatura}
          onChange={(e) => setFiltroTemperatura(e.target.value)}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
        >
          <option value="">Todas as temperaturas</option>
          {TEMPERATURAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
        {ORDEM_FUNIL.map((estado) => {
          const lista = porEstado.get(estado) ?? []
          const cor = ESTADOS_LEAD[estado]
          const podeReceberDrop = estado !== 'Ganha'
          return (
            <div
              key={estado}
              onDragOver={(e) => {
                if (!podeReceberDrop) return
                e.preventDefault()
                setDragOverEstado(estado)
              }}
              onDragLeave={() => setDragOverEstado((atual) => (atual === estado ? null : atual))}
              onDrop={(e) => {
                if (!podeReceberDrop) return
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain')
                if (id) largar(id, estado)
              }}
              className={`flex w-64 shrink-0 flex-col gap-2 rounded-xl border p-2 transition-colors ${
                dragOverEstado === estado
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-subtle bg-foreground/[0.02]'
              }`}
            >
              <h2 className="flex items-center justify-between gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                <span className="rounded-full px-2 py-0.5" style={{ background: cor.bg, color: cor.tx }}>
                  {estado}
                </span>
                <span>{lista.length}</span>
              </h2>

              <div className="flex flex-col gap-2">
                {lista.map((l) => {
                  const urgencia = !l.proximo_contacto
                    ? null
                    : l.proximo_contacto < hoje
                      ? 'vermelho'
                      : l.proximo_contacto === hoje
                        ? 'ambar'
                        : 'verde'
                  const corUrgencia =
                    urgencia === 'vermelho'
                      ? PALETA.vermelho
                      : urgencia === 'ambar'
                        ? PALETA.ambar
                        : urgencia === 'verde'
                          ? PALETA.verde
                          : null
                  const temp = l.temperatura ?? 'Morna'
                  return (
                    <Link
                      key={l.id}
                      href={`/painel/${estudioSlug}/leads/${l.id}`}
                      draggable={estado !== 'Ganha'}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', l.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface p-3 text-left transition-colors hover:border-brand/50 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm text-foreground">{l.nome}</strong>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: CORES_TEMPERATURA[temp].bg, color: CORES_TEMPERATURA[temp].tx }}
                        >
                          {temp}
                        </span>
                      </div>
                      {l.telefone && <p className="text-xs text-muted">{l.telefone}</p>}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span>há {diasDesde(l.entrada)}d</span>
                        {l.responsavel && <span>· {l.responsavel.nome}</span>}
                        {l.valor_potencial != null && <span>· €{l.valor_potencial}</span>}
                      </div>
                      {l.origem && (
                        <span
                          className="self-start rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: corOrigem(l.origem).bg, color: corOrigem(l.origem).tx }}
                        >
                          {l.origem}
                        </span>
                      )}
                      {l.proximo_contacto && corUrgencia && (
                        <span
                          className="self-start rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: corUrgencia.bg, color: corUrgencia.tx }}
                        >
                          contacto {fmt(l.proximo_contacto)}
                        </span>
                      )}
                      {l.visita_data && (
                        <span className="self-start rounded-full bg-[#E9E5F7] px-2 py-0.5 text-[11px] font-medium text-[#5B3FA0]">
                          Visita {fmt(l.visita_data)}
                          {l.visita_hora ? ` ${l.visita_hora.slice(0, 5)}` : ''}
                        </span>
                      )}
                    </Link>
                  )
                })}
                {lista.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-zinc-400">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
