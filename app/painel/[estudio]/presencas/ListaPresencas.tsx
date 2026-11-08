'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { TriangleAlert, CalendarX, UsersRound, CalendarOff, Repeat, Ban, type LucideIcon } from 'lucide-react'
import { normalizarTexto } from '@/lib/texto'
import AnelProgresso from '@/components/AnelProgresso'
import type { EstadoCliente } from '@/lib/supabase/database.types'

export type LinhaPresenca = {
  id: string
  nome: string
  estado: EstadoCliente
  feitos: number
  faltas: number
  avisadas: number
  alvo: number | null
  pct: number | null
  pago: boolean
  temAgendado: boolean
}

export type LinhaDesmarcacao = {
  clienteId: string
  nome: string
  estado: EstadoCliente
  pago: boolean
  total: number
  remarcadas: number
  naoRemarcadas: number
}

function porNomeSimples<T extends { nome: string }>(lista: T[], filtro: string): T[] {
  const alvo = filtro ? normalizarTexto(filtro) : null
  return alvo ? lista.filter((l) => normalizarTexto(l.nome).includes(alvo)) : lista
}

// Cartão do resumo no topo — números estáveis (nunca filtrados pela
// pesquisa), para dar sempre o retrato real do estúdio à primeira
// vista. Clicável: leva diretamente à tabela completa desses dados
// (âncora para a secção correspondente mais abaixo nesta página, ou
// outra página quando a lista completa vive lá).
function CartaoResumo({
  icone: Icone,
  cor,
  label,
  valor,
  href,
}: {
  icone: LucideIcon
  cor: string
  label: string
  valor: number
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card transition-colors hover:border-border-strong hover:bg-brand/[.04]"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cor}`}>
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xl font-bold leading-none text-foreground">{valor}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">{label}</p>
      </div>
    </Link>
  )
}

// Mesma formatação da LinhaCompacta de Pagamentos: nome a truncar à
// esquerda, bloco fixo (shrink-0, nunca quebra linha) à direita —
// aqui com estado + aviso + anel, em vez de só o aviso. Nome e
// estado têm largura fixa (em vez de ajustar-se ao texto), e o
// aviso fica encostado à esquerda logo a seguir (não "justify-end"
// a empurrar para a direita) — tudo para ficar alinhado em coluna,
// linha a linha, só o anel (que varia de tamanho conforme o texto
// antes dele) é que fica à parte, sempre no fim.
function LinhaCliente({
  href,
  nome,
  estadoLabel,
  primeira,
  corFundo,
  corBorda,
  pct,
  children,
}: {
  href: string
  nome: string
  estadoLabel?: string
  primeira: boolean
  corFundo: string
  corBorda: string
  pct: number | null
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 text-xs ${corFundo} ${primeira ? '' : corBorda}`}
    >
      <span className="w-32 shrink-0 truncate font-medium text-foreground">{nome}</span>
      <span className="w-20 shrink-0">
        {estadoLabel && (
          <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {estadoLabel}
          </span>
        )}
      </span>
      <span className="flex flex-1 items-center gap-1.5">
        {children}
        {pct != null && (
          <AnelProgresso size={28} strokeWidth={3} percent={pct} color={pct >= 100 ? '#1E7145' : '#0E9594'}>
            <span className="text-[9px] font-semibold text-foreground">{pct}%</span>
          </AnelProgresso>
        )}
      </span>
    </Link>
  )
}

const ALTURA_LISTA = 'max-h-80 overflow-y-auto'

export default function ListaPresencas({
  linhas,
  desmarcacoes,
  slug,
  ano,
  mes,
}: {
  linhas: LinhaPresenca[]
  desmarcacoes: LinhaDesmarcacao[]
  slug: string
  ano: number
  mes: number
}) {
  const [filtro, setFiltro] = useState('')

  const idsComDesmarcacao = useMemo(() => new Set(desmarcacoes.map((d) => d.clienteId)), [desmarcacoes])

  // O caso mais delicado: treinar (ou ter treino agendado, ou ter
  // desmarcado um) sem o pagamento em dia. É precisamente o que o
  // dono pediu para deixar de passar escondido por a página só
  // mostrar quem está "Ativo" e pago.
  const ehConflito = useMemo(
    () => (l: LinhaPresenca) => !l.pago && (l.feitos > 0 || l.temAgendado || idsComDesmarcacao.has(l.id)),
    [idsComDesmarcacao]
  )

  // Quem já pagou mas ainda não apareceu uma única vez este mês — é o
  // caso que precisa de ação (um telefonema, por exemplo), por isso
  // fica destacado e separado do resto em vez de se perder na lista.
  const semTreinoPago = useMemo(() => linhas.filter((l) => l.pago && l.feitos === 0), [linhas])
  const comFaltas = useMemo(() => linhas.filter((l) => l.faltas > 0), [linhas])
  const semPagamentoEmDia = useMemo(() => linhas.filter(ehConflito), [linhas, ehConflito])
  const totalDesmarcacoes = useMemo(() => desmarcacoes.reduce((soma, d) => soma + d.total, 0), [desmarcacoes])

  const { alertaFiltrado, conflitoFiltrado, restoFiltrado } = useMemo(() => {
    const filtrados = porNomeSimples(linhas, filtro)
    const porNome = (a: LinhaPresenca, b: LinhaPresenca) =>
      normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome))
    return {
      alertaFiltrado: filtrados.filter((l) => l.pago && l.feitos === 0).sort(porNome),
      conflitoFiltrado: filtrados.filter(ehConflito).sort(porNome),
      restoFiltrado: filtrados.filter((l) => !(l.pago && l.feitos === 0) && !ehConflito(l)).sort(porNome),
    }
  }, [linhas, filtro, ehConflito])

  // Mais faltas primeiro — mesma lógica das desmarcações, é quem
  // mais falta que interessa ver primeiro.
  const comFaltasFiltradas = useMemo(() => {
    return [...porNomeSimples(comFaltas, filtro)].sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas
      return normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome))
    })
  }, [comFaltas, filtro])

  // Quem mais desmarca primeiro — é a leitura que interessa para
  // perceber "quantas pessoas estão a desmarcar" de um olhar.
  const desmarcacoesFiltradas = useMemo(() => {
    return [...porNomeSimples(desmarcacoes, filtro)].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome))
    })
  }, [desmarcacoes, filtro])

  const aPesquisar = filtro.trim().length > 0
  const semResultados = alertaFiltrado.length === 0 && conflitoFiltrado.length === 0 && restoFiltrado.length === 0

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CartaoResumo
          icone={TriangleAlert}
          cor="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          label="Pagaram, sem treinos"
          valor={semTreinoPago.length}
          href="#pagaram-sem-treinos"
        />
        <CartaoResumo
          icone={Ban}
          cor="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          label="Sem pagamento em dia"
          valor={semPagamentoEmDia.length}
          href="#sem-pagamento-em-dia"
        />
        <CartaoResumo
          icone={CalendarX}
          cor="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          label="Com faltas"
          valor={comFaltas.length}
          href="#com-faltas"
        />
        <CartaoResumo
          icone={CalendarOff}
          cor="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
          label="Clientes a desmarcar"
          valor={desmarcacoes.length}
          href="#desmarcacoes"
        />
        <CartaoResumo
          icone={Repeat}
          cor="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
          label="Desmarcações este mês"
          valor={totalDesmarcacoes}
          href="#desmarcacoes"
        />
        <CartaoResumo
          icone={UsersRound}
          cor="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
          label="Total de clientes"
          valor={linhas.length}
          href={`/painel/${slug}/clientes`}
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
          {aPesquisar ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes neste estúdio.'}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div id="pagaram-sem-treinos" className="scroll-mt-20">
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
                    pct={l.pct}
                  >
                    <span className="font-medium text-red-700 dark:text-red-300">
                      ainda sem treinos
                    </span>
                  </LinhaCliente>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém nesta situação.</p>
            )}
          </div>

          {/* O conflito que o dono pediu para deixar de passar
              escondido: gente a treinar (feito, agendado ou desmarcado
              este mês) sem ter o pagamento em dia. */}
          <div id="sem-pagamento-em-dia" className="scroll-mt-20">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              A treinar sem pagamento em dia ({conflitoFiltrado.length})
            </h2>
            {conflitoFiltrado.length > 0 ? (
              <div
                className={`mt-2 flex flex-col overflow-hidden rounded-xl border border-rose-200 dark:border-rose-900 ${ALTURA_LISTA}`}
              >
                {conflitoFiltrado.map((l, i) => (
                  <LinhaCliente
                    key={l.id}
                    href={`/painel/${slug}/presencas/${l.id}?ano=${ano}&mes=${mes}`}
                    nome={l.nome}
                    estadoLabel={l.estado !== 'Ativo' ? l.estado : undefined}
                    primeira={i === 0}
                    corFundo="bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-950/40 dark:hover:bg-rose-950/70"
                    corBorda="border-t border-rose-200 dark:border-rose-900"
                    pct={l.pct}
                  >
                    <span className="font-medium text-rose-700 dark:text-rose-300">
                      {l.feitos > 0 ? 'já treinou' : l.temAgendado ? 'tem treino agendado' : 'desmarcou treino'}
                    </span>
                  </LinhaCliente>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém nesta situação.</p>
            )}
          </div>

          <div>
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
                    estadoLabel={l.estado !== 'Ativo' ? l.estado : undefined}
                    primeira={i === 0}
                    corFundo="bg-surface hover:bg-brand/[.06]"
                    corBorda="border-t border-border-subtle"
                    pct={l.pct}
                  >
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
                  </LinhaCliente>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém com esse nome.</p>
            )}
          </div>
        </div>
      )}

      {/* Tabela completa de quem tem faltas este mês, para o cartão
          de resumo "Com faltas" ter para onde apontar. */}
      <div id="com-faltas" className="mt-6 scroll-mt-20">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Com faltas este mês ({comFaltasFiltradas.length})
        </h2>
        {comFaltasFiltradas.length > 0 ? (
          <div className={`mt-2 flex flex-col overflow-hidden rounded-xl border border-amber-200 dark:border-amber-900 ${ALTURA_LISTA}`}>
            {comFaltasFiltradas.map((l, i) => (
              <LinhaCliente
                key={l.id}
                href={`/painel/${slug}/presencas/${l.id}?ano=${ano}&mes=${mes}`}
                nome={l.nome}
                estadoLabel={l.estado !== 'Ativo' ? l.estado : undefined}
                primeira={i === 0}
                corFundo="bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/70"
                corBorda="border-t border-amber-200 dark:border-amber-900"
                pct={l.pct}
              >
                <span className="rounded-full bg-red-50 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  {l.faltas} {l.faltas === 1 ? 'falta' : 'faltas'}
                </span>
                {l.avisadas > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    {l.avisadas} {l.avisadas === 1 ? 'avisada' : 'avisadas'}
                  </span>
                )}
              </LinhaCliente>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {aPesquisar ? 'Ninguém com esse nome faltou este mês.' : 'Ninguém faltou este mês.'}
          </p>
        )}
      </div>

      {/* Além das presenças de cada um — quem está a desmarcar treinos
          este mês, quantas vezes, e se essas sessões já foram ou não
          remarcadas para outro dia. Fica a toda a largura (é a secção
          com mais informação por linha, precisa do espaço). */}
      <div id="desmarcacoes" className="mt-6 scroll-mt-20">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
          Desmarcações este mês ({desmarcacoesFiltradas.length})
        </h2>
        {desmarcacoesFiltradas.length > 0 ? (
          <div
            className={`mt-2 flex flex-col overflow-hidden rounded-xl border border-orange-200 dark:border-orange-900 ${ALTURA_LISTA}`}
          >
            {desmarcacoesFiltradas.map((d, i) => (
              <LinhaCliente
                key={d.clienteId}
                href={`/painel/${slug}/presencas/${d.clienteId}?ano=${ano}&mes=${mes}`}
                nome={d.nome}
                estadoLabel={d.estado !== 'Ativo' ? d.estado : undefined}
                primeira={i === 0}
                corFundo="bg-orange-50 hover:bg-orange-100/70 dark:bg-orange-950/40 dark:hover:bg-orange-950/70"
                corBorda="border-t border-orange-200 dark:border-orange-900"
                pct={null}
              >
                <span className="text-orange-800 dark:text-orange-200">
                  {d.total} {d.total === 1 ? 'desmarcação' : 'desmarcações'}
                  {d.remarcadas > 0 && ` · ${d.remarcadas} remarcada${d.remarcadas === 1 ? '' : 's'}`}
                  {d.naoRemarcadas > 0 &&
                    ` · ${d.naoRemarcadas} não remarcada${d.naoRemarcadas === 1 ? '' : 's'}`}
                </span>
                {!d.pago && (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 font-medium text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                    sem pagamento em dia
                  </span>
                )}
              </LinhaCliente>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {aPesquisar ? 'Ninguém com esse nome desmarcou este mês.' : 'Ninguém desmarcou treinos este mês.'}
          </p>
        )}
      </div>
    </>
  )
}
