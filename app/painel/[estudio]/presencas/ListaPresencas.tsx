'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { TriangleAlert, CalendarX, UsersRound, type LucideIcon } from 'lucide-react'
import { normalizarTexto } from '@/lib/texto'

export type LinhaPresenca = {
  id: string
  nome: string
  feitos: number
  faltas: number
  avisadas: number
  alvo: number | null
  pago: boolean
}

function porNomeSimples<T extends { nome: string }>(lista: T[], filtro: string): T[] {
  const alvo = filtro ? normalizarTexto(filtro) : null
  return alvo ? lista.filter((l) => normalizarTexto(l.nome).includes(alvo)) : lista
}

// Cartão do resumo no topo — números estáveis (nunca filtrados pela
// pesquisa), para dar sempre o retrato real do estúdio à primeira
// vista.
function CartaoResumo({
  icone: Icone,
  cor,
  label,
  valor,
}: {
  icone: LucideIcon
  cor: string
  label: string
  valor: number
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cor}`}>
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xl font-bold leading-none text-foreground">{valor}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">{label}</p>
      </div>
    </div>
  )
}

// Uma linha por pessoa, nome à esquerda e o que importa à direita —
// nada de avatares decorativos, para a lista caber mais gente por
// ecrã e ler-se de uma vez.
function LinhaCliente({
  href,
  nome,
  primeira,
  corFundo,
  corBorda,
  children,
}: {
  href: string
  nome: string
  primeira: boolean
  corFundo: string
  corBorda: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 px-3 py-2 text-xs ${corFundo} ${
        primeira ? '' : corBorda
      }`}
    >
      <span className="truncate font-medium text-foreground">{nome}</span>
      {children}
    </Link>
  )
}

const ALTURA_LISTA = 'max-h-80 overflow-y-auto'

export default function ListaPresencas({
  linhas,
  slug,
  ano,
  mes,
}: {
  linhas: LinhaPresenca[]
  slug: string
  ano: number
  mes: number
}) {
  const [filtro, setFiltro] = useState('')

  // Quem já pagou mas ainda não apareceu uma única vez este mês — é o
  // caso que precisa de ação (um telefonema, por exemplo), por isso
  // fica destacado e separado do resto em vez de se perder na lista.
  const semTreinoPago = useMemo(() => linhas.filter((l) => l.pago && l.feitos === 0), [linhas])
  const comFaltas = useMemo(() => linhas.filter((l) => l.faltas > 0), [linhas])

  const { alertaFiltrado, restoFiltrado } = useMemo(() => {
    const filtrados = porNomeSimples(linhas, filtro)
    const porNome = (a: LinhaPresenca, b: LinhaPresenca) =>
      normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome))
    return {
      alertaFiltrado: filtrados.filter((l) => l.pago && l.feitos === 0).sort(porNome),
      restoFiltrado: filtrados.filter((l) => !(l.pago && l.feitos === 0)).sort(porNome),
    }
  }, [linhas, filtro])

  const aPesquisar = filtro.trim().length > 0
  const semResultados = alertaFiltrado.length === 0 && restoFiltrado.length === 0

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <CartaoResumo
          icone={TriangleAlert}
          cor="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          label="Pagaram, sem treinos"
          valor={semTreinoPago.length}
        />
        <CartaoResumo
          icone={CalendarX}
          cor="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          label="Com faltas"
          valor={comFaltas.length}
        />
        <CartaoResumo
          icone={UsersRound}
          cor="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
          label="Total ativos"
          valor={linhas.length}
        />
      </div>

      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Procurar por nome…"
        className="mt-4 w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900"
      />

      {semResultados ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-zinc-500">
          {aPesquisar ? 'Nenhum cliente ativo com esse nome.' : 'Ainda não há clientes ativos neste estúdio.'}
        </div>
      ) : (
        <>
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600">
              Pagaram e ainda não treinaram ({alertaFiltrado.length})
            </h2>
            {alertaFiltrado.length > 0 ? (
              <div
                className={`mt-2 flex flex-col overflow-hidden rounded-xl border border-red-200 dark:border-red-900 ${ALTURA_LISTA}`}
              >
                {alertaFiltrado.map((l, i) => (
                  <LinhaCliente
                    key={l.id}
                    href={`/painel/${slug}/presencas/${l.id}?ano=${ano}&mes=${mes}`}
                    nome={l.nome}
                    primeira={i === 0}
                    corFundo="bg-red-50 hover:bg-red-100/70 dark:bg-red-950/40 dark:hover:bg-red-950/70"
                    corBorda="border-t border-red-200 dark:border-red-900"
                  >
                    <span className="shrink-0 font-medium text-red-700 dark:text-red-300">
                      ainda sem treinos
                    </span>
                  </LinhaCliente>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém nesta situação.</p>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Restantes clientes ({restoFiltrado.length})
            </h2>
            {restoFiltrado.length > 0 ? (
              <div className={`mt-2 flex flex-col overflow-hidden rounded-xl border border-border-subtle ${ALTURA_LISTA}`}>
                {restoFiltrado.map((l, i) => (
                  <LinhaCliente
                    key={l.id}
                    href={`/painel/${slug}/presencas/${l.id}?ano=${ano}&mes=${mes}`}
                    nome={l.nome}
                    primeira={i === 0}
                    corFundo="bg-surface hover:bg-brand/[.06]"
                    corBorda="border-t border-border-subtle"
                  >
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-muted">
                        {l.feitos}{l.alvo != null ? `/${l.alvo}` : ''} treinos
                      </span>
                      {l.faltas > 0 && (
                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                          {l.faltas} {l.faltas === 1 ? 'falta' : 'faltas'}
                        </span>
                      )}
                      {l.avisadas > 0 && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {l.avisadas} {l.avisadas === 1 ? 'avisada' : 'avisadas'}
                        </span>
                      )}
                    </div>
                  </LinhaCliente>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém com esse nome.</p>
            )}
          </div>
        </>
      )}
    </>
  )
}
