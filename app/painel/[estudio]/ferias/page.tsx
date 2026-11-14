import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, Lock, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEstudios } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { MESES } from '@/lib/data/presencas'
import { hojeLisboa, intervaloDias, type BloqueioFerias } from '@/lib/data/assiduidade'
import {
  configDoPerfil,
  equipaAssiduidade,
  limiteFeriasSimultaneo,
  podeUsarComoInstrutor,
} from '@/lib/data/equipaAssiduidade'
import SubmitButton from '@/components/SubmitButton'
import CalendarioFerias, { type EstadoDiaProprio } from './CalendarioFerias'
import {
  apagarBloqueioFerias,
  cancelarPedidoFerias,
  criarBloqueioFerias,
  guardarLimiteFerias,
  reverPedidoFerias,
} from './actions'

type Pedido = {
  id: string
  perfil_id: string
  estudio_id: number
  ano: number
  dias: string[]
  dias_uteis: number
  estado: 'Pendente' | 'Aprovado' | 'Recusado'
  motivo_recusa: string | null
  criado_em: string
  revisto_em: string | null
  perfil: { nome: string } | null
}

const CORES_ESTADO: Record<Pedido['estado'], string> = {
  Pendente: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Aprovado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Recusado: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}
const ROTULO_ESTADO: Record<Pedido['estado'], string> = {
  Pendente: 'Aguarda aprovação',
  Aprovado: 'Aprovado',
  Recusado: 'Recusado',
}

const dataCurta = (d: string) => d.split('-').reverse().join('/')

export default async function FeriasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ ano?: string; error?: string; ok?: string }>
}) {
  const { estudio: slug } = await params
  const { ano: anoParam, error, ok } = await searchParams
  const hoje = hojeLisboa()
  const anoAtual = Number(hoje.slice(0, 4))
  const ano = /^\d{4}$/.test(anoParam ?? '') ? Number(anoParam) : anoAtual

  const supabase = await createClient()
  const [sessao, estudio, estudios] = await Promise.all([
    getSessaoAtual(),
    getEstudioPorSlug(supabase, slug),
    getEstudios(supabase),
  ])
  if (!estudio) notFound()
  const { ehGestao } = papeisDaSessao(sessao)
  const instrutor = podeUsarComoInstrutor(sessao)

  const [{ data: pedidosData, error: erroPedidos }, { data: bloqueiosData }, limite, equipa, config] = await Promise.all([
    supabase
      .from('pedidos_ferias')
      .select('id, perfil_id, estudio_id, ano, dias, dias_uteis, estado, motivo_recusa, criado_em, revisto_em, perfil:perfis!perfil_id(nome)')
      .eq('ano', ano)
      .order('criado_em', { ascending: false }),
    supabase.from('ferias_bloqueios').select('id, inicio, fim, estudio_id, motivo').order('inicio'),
    limiteFeriasSimultaneo(supabase),
    ehGestao ? equipaAssiduidade(supabase, estudio.id) : Promise.resolve([]),
    instrutor && sessao.userId ? configDoPerfil(supabase, sessao.userId, estudio.id) : Promise.resolve(null),
  ])
  if (erroPedidos) throw new Error(erroPedidos.message)
  const pedidos = (pedidosData ?? []) as unknown as Pedido[]
  const bloqueios = (bloqueiosData ?? []) as (BloqueioFerias & { id: string })[]
  const nomeEstudio = new Map(estudios.map((e) => [e.id, e.nome]))

  // Vista do instrutor: os seus dias e quantos colegas do mesmo estúdio
  // já estão de férias (pedido pendente ou aprovado) em cada dia.
  const meusPedidos = pedidos.filter((p) => p.perfil_id === sessao.userId)
  const meusDias: Record<string, EstadoDiaProprio> = {}
  for (const p of meusPedidos) {
    if (p.estado === 'Recusado') continue
    for (const d of p.dias) meusDias[d] = p.estado
  }
  const outrosDeFerias: Record<string, number> = {}
  if (config) {
    for (const p of pedidos) {
      if (p.perfil_id === sessao.userId || p.estado === 'Recusado' || p.estudio_id !== config.estudio_id) continue
      for (const d of p.dias) outrosDeFerias[d] = (outrosDeFerias[d] ?? 0) + 1
    }
  }
  const slugFeriados = estudios.find((e) => e.id === config?.estudio_id)?.slug ?? slug
  const diasAprovados = meusPedidos.filter((p) => p.estado === 'Aprovado').reduce((s, p) => s + p.dias_uteis, 0)
  const diasPendentes = meusPedidos.filter((p) => p.estado === 'Pendente').reduce((s, p) => s + p.dias_uteis, 0)

  // Vista da gestão: só os pedidos deste estúdio.
  const doEstudio = pedidos.filter((p) => p.estudio_id === estudio.id)
  const pendentes = doEstudio.filter((p) => p.estado === 'Pendente').reverse()
  const decididos = doEstudio.filter((p) => p.estado !== 'Pendente')
  const mapaOficial = new Map<string, { aprovados: number[]; pendentes: number[] }>()
  for (const p of doEstudio) {
    if (p.estado === 'Recusado') continue
    const linha = mapaOficial.get(p.perfil_id) ?? { aprovados: Array(12).fill(0), pendentes: Array(12).fill(0) }
    for (const d of p.dias) {
      const m = Number(d.slice(5, 7)) - 1
      if (p.estado === 'Aprovado') linha.aprovados[m]++
      else linha.pendentes[m]++
    }
    mapaOficial.set(p.perfil_id, linha)
  }
  const pessoasMapa = [
    ...equipa.map((m) => ({ id: m.id, nome: m.nome })),
    ...doEstudio
      .filter((p) => !equipa.some((m) => m.id === p.perfil_id))
      .map((p) => ({ id: p.perfil_id, nome: p.perfil?.nome?.trim() ?? '—' })),
  ].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
  const bloqueiosAno = bloqueios.filter((b) => b.fim >= `${ano}-01-01` && b.inicio <= `${ano}-12-31`)

  const linkAno = (a: number) => `/painel/${slug}/ferias?ano=${a}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mapa de Férias</h1>
          <p className="mt-1 text-sm text-muted">
            {instrutor
              ? 'Escolhe os teus dias de férias no calendário e envia o pedido à administração.'
              : 'Pedidos de férias da equipa, regras e mapa oficial.'}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-card">
          <Link href={linkAno(ano - 1)} aria-label="Ano anterior" className="rounded-full p-1.5 text-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-sm font-semibold tabular-nums text-foreground">{ano}</span>
          <Link href={linkAno(ano + 1)} aria-label="Ano seguinte" className="rounded-full p-1.5 text-muted hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}
      {ok === 'pedido' && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Pedido enviado. Os dias ficam a aguardar aprovação da administração.
        </p>
      )}

      {instrutor && config && (
        <section className="mt-6">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {diasAprovados} dias úteis aprovados
            </span>
            {diasPendentes > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {diasPendentes} a aguardar aprovação
              </span>
            )}
          </div>
          <CalendarioFerias
            key={`${ano}:${Object.keys(meusDias).join(',')}`}
            estudioSlug={slug}
            ano={ano}
            hoje={hoje}
            slugFeriados={slugFeriados}
            estudioId={config.estudio_id}
            bloqueios={bloqueios.map(({ inicio, fim, estudio_id, motivo }) => ({ inicio, fim, estudio_id, motivo }))}
            outrosDeFerias={outrosDeFerias}
            limiteSimultaneo={limite}
            meusDias={meusDias}
          />

          {meusPedidos.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-foreground">Os meus pedidos</h2>
              <ul className="mt-2 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface shadow-card">
                {meusPedidos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="font-medium text-foreground">{intervaloDias(p.dias)}</span>
                    <span className="text-muted">
                      {p.dias.length} {p.dias.length === 1 ? 'dia' : 'dias'} · {p.dias_uteis} úteis
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CORES_ESTADO[p.estado]}`}>
                      {ROTULO_ESTADO[p.estado]}
                    </span>
                    {p.estado === 'Recusado' && p.motivo_recusa && (
                      <span className="text-xs text-muted">Motivo: {p.motivo_recusa}</span>
                    )}
                    {p.estado === 'Pendente' && (
                      <form action={cancelarPedidoFerias} className="ml-auto">
                        <input type="hidden" name="estudio_slug" value={slug} />
                        <input type="hidden" name="ano" value={ano} />
                        <input type="hidden" name="pedido_id" value={p.id} />
                        <SubmitButton
                          pendingText="A cancelar…"
                          className="rounded-full border border-border-subtle px-3 py-1 text-xs font-semibold text-muted hover:text-foreground"
                        >
                          Cancelar pedido
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {!instrutor && !ehGestao && (
        <p className="mt-6 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm text-muted shadow-card">
          Esta é uma conta partilhada do estúdio. Para pedir férias, entra com a tua conta pessoal.
        </p>
      )}

      {ehGestao && (
        <>
          {!instrutor && (
            <p className="mt-6 text-xs text-muted">
              Para pedir férias, cada instrutor entra com a sua conta pessoal. Aqui revês os pedidos de {estudio.nome}.
            </p>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">
              Pedidos por aprovar{' '}
              {pendentes.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {pendentes.length}
                </span>
              )}
            </h2>
            {pendentes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nenhum pedido pendente em {ano}.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {pendentes.map((p) => (
                  <li key={p.id} className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-semibold text-foreground">{p.perfil?.nome?.trim() ?? '—'}</span>
                      <span className="text-sm text-foreground">{intervaloDias(p.dias)}</span>
                      <span className="text-sm text-muted">
                        {p.dias.length} {p.dias.length === 1 ? 'dia' : 'dias'} · {p.dias_uteis} úteis
                      </span>
                      <span className="text-xs text-muted">pedido a {dataCurta(p.criado_em.slice(0, 10))}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{p.dias.map((d) => dataCurta(d).slice(0, 5)).join(' · ')}</p>
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <form action={reverPedidoFerias}>
                        <input type="hidden" name="estudio_slug" value={slug} />
                        <input type="hidden" name="ano" value={ano} />
                        <input type="hidden" name="pedido_id" value={p.id} />
                        <input type="hidden" name="decisao" value="Aprovado" />
                        <SubmitButton
                          pendingText="A aprovar…"
                          className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          Aprovar
                        </SubmitButton>
                      </form>
                      <details className="group">
                        <summary className="cursor-pointer list-none rounded-full border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                          Recusar…
                        </summary>
                        <form action={reverPedidoFerias} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="estudio_slug" value={slug} />
                          <input type="hidden" name="ano" value={ano} />
                          <input type="hidden" name="pedido_id" value={p.id} />
                          <input type="hidden" name="decisao" value="Recusado" />
                          <input
                            name="motivo"
                            required
                            placeholder="Motivo da recusa (o instrutor vai ver)"
                            className="w-72 max-w-full rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-sm"
                          />
                          <SubmitButton
                            pendingText="A recusar…"
                            className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Confirmar recusa
                          </SubmitButton>
                        </form>
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">Mapa oficial {ano} — {estudio.nome}</h2>
            <p className="mt-1 text-xs text-muted">
              Dias de férias por mês. A verde, aprovados (entram no fecho mensal de horas); a âmbar, por aprovar.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle bg-surface shadow-card">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">Instrutor</th>
                    {MESES.map((m) => (
                      <th key={m} className="px-1 py-2 text-center font-medium">{m.slice(0, 3)}</th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoasMapa.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-3 py-4 text-center text-muted">Sem instrutores com conta pessoal neste estúdio.</td>
                    </tr>
                  )}
                  {pessoasMapa.map((pessoa) => {
                    const linha = mapaOficial.get(pessoa.id)
                    const total = linha ? linha.aprovados.reduce((a, b) => a + b, 0) : 0
                    return (
                      <tr key={pessoa.id} className="border-b border-border-subtle last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{pessoa.nome}</td>
                        {MESES.map((m, i) => (
                          <td key={m} className="px-1 py-2 text-center tabular-nums">
                            {linha && linha.aprovados[i] > 0 && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {linha.aprovados[i]}
                              </span>
                            )}
                            {linha && linha.pendentes[i] > 0 && (
                              <span className="ml-0.5 rounded border border-dashed border-amber-500 px-1 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                                {linha.pendentes[i]}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Lock className="h-4 w-4" /> Regras &amp; Períodos Interditos
              </h2>
              <p className="mt-1 text-xs text-muted">
                Nestes períodos os instrutores não conseguem escolher dias — veem um cadeado e o motivo.
              </p>
              {bloqueiosAno.length > 0 ? (
                <ul className="mt-3 divide-y divide-border-subtle">
                  {bloqueiosAno.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                      <span className="font-medium tabular-nums text-foreground">
                        {dataCurta(b.inicio)} – {dataCurta(b.fim)}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {b.estudio_id === null ? 'Todos' : nomeEstudio.get(b.estudio_id) ?? '—'}
                      </span>
                      <span className="text-muted">{b.motivo}</span>
                      <form action={apagarBloqueioFerias} className="ml-auto">
                        <input type="hidden" name="estudio_slug" value={slug} />
                        <input type="hidden" name="ano" value={ano} />
                        <input type="hidden" name="bloqueio_id" value={b.id} />
                        <SubmitButton
                          pendingText="…"
                          aria-label="Apagar período"
                          title="Apagar período"
                          className="rounded-full p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">Sem períodos interditos em {ano}.</p>
              )}
              <form action={criarBloqueioFerias} className="mt-4 grid gap-2 sm:grid-cols-[auto_auto_auto_1fr_auto] sm:items-end">
                <input type="hidden" name="estudio_slug" value={slug} />
                <input type="hidden" name="ano" value={ano} />
                <label className="text-xs text-muted">
                  Início
                  <input type="date" name="inicio" required className="mt-1 block w-full rounded-lg border border-border-subtle bg-background px-2 py-1.5 text-sm text-foreground" />
                </label>
                <label className="text-xs text-muted">
                  Fim
                  <input type="date" name="fim" required className="mt-1 block w-full rounded-lg border border-border-subtle bg-background px-2 py-1.5 text-sm text-foreground" />
                </label>
                <label className="text-xs text-muted">
                  Âmbito
                  <select name="ambito" defaultValue="todos" className="mt-1 block w-full rounded-lg border border-border-subtle bg-background px-2 py-1.5 text-sm text-foreground">
                    <option value="todos">Todos</option>
                    {estudios.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted">
                  Motivo
                  <input name="motivo" required placeholder="Ex.: Período de pico" className="mt-1 block w-full rounded-lg border border-border-subtle bg-background px-2 py-1.5 text-sm text-foreground" />
                </label>
                <SubmitButton pendingText="A guardar…" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-black">
                  Adicionar
                </SubmitButton>
              </form>
            </div>

            <form action={guardarLimiteFerias} className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="ano" value={ano} />
              <h2 className="text-base font-semibold text-foreground">Limite em simultâneo</h2>
              <p className="mt-1 text-xs text-muted">
                Máximo de instrutores do mesmo estúdio de férias no mesmo dia. Vazio = sem limite.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  name="limite"
                  min={1}
                  step={1}
                  defaultValue={limite ?? ''}
                  placeholder="Sem limite"
                  className="w-28 rounded-lg border border-border-subtle bg-background px-2 py-1.5 text-sm text-foreground"
                />
                <SubmitButton pendingText="A guardar…" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-black">
                  Guardar
                </SubmitButton>
              </div>
            </form>
          </section>

          {decididos.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">Histórico de decisões ({decididos.length})</summary>
              <ul className="mt-2 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface shadow-card">
                {decididos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium text-foreground">{p.perfil?.nome?.trim() ?? '—'}</span>
                    <span className="text-foreground">{intervaloDias(p.dias)}</span>
                    <span className="text-muted">{p.dias_uteis} úteis</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CORES_ESTADO[p.estado]}`}>{ROTULO_ESTADO[p.estado]}</span>
                    {p.motivo_recusa && <span className="text-xs text-muted">{p.motivo_recusa}</span>}
                    {p.revisto_em && <span className="ml-auto text-xs text-muted">{dataCurta(p.revisto_em.slice(0, 10))}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}
