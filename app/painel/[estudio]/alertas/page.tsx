import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { PALETA } from '@/lib/data/constantes'
import { marcarVisto, resolverAlerta, adiarAlerta } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { AlertaRegistado, SeveridadeAlerta } from '@/lib/supabase/database.types'

const ORDEM_SEVERIDADE: SeveridadeAlerta[] = ['Crítico', 'Atenção', 'Info']
const COR_SEVERIDADE: Record<SeveridadeAlerta, { bg: string; tx: string }> = {
  Crítico: PALETA.vermelho,
  Atenção: PALETA.ambar,
  Info: PALETA.azul,
}

function hrefDaEntidade(slug: string, alerta: AlertaRegistado) {
  if (alerta.lead_id) return `/painel/${slug}/leads/${alerta.lead_id}`
  if (alerta.cliente_id) return `/painel/${slug}/clientes/${alerta.cliente_id}`
  return null
}

export default async function AlertasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }

  const { data, error: erroAlertas } = await supabase
    .from('alerts')
    .select('*')
    .eq('estudio_id', estudio.id)
    .neq('estado', 'Resolvido')
    .order('criado_em', { ascending: false })

  if (erroAlertas) {
    throw new Error(erroAlertas.message)
  }

  const { ehGestao } = papeisDaSessao(sessao)
  const todosAlertas = (data ?? []) as AlertaRegistado[]
  // Quem não gere o estúdio só vê os alertas destinados ao seu papel
  // (ex.: PT só vê "mensalidade em atraso") — os restantes, sem papel
  // definido, ficam só visíveis à gestão.
  const alertas = ehGestao
    ? todosAlertas
    : todosAlertas.filter((a) => a.papel_destinatario && a.papel_destinatario === sessao.perfil?.papel)

  const porSeveridade = new Map<SeveridadeAlerta, AlertaRegistado[]>()
  for (const a of alertas) {
    const lista = porSeveridade.get(a.severidade) ?? []
    lista.push(a)
    porSeveridade.set(a.severidade, lista)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Centro de alertas</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {estudio.nome} · {alertas.length} {alertas.length === 1 ? 'alerta aberto' : 'alertas abertos'}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {alertas.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          Sem alertas em aberto.
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {ORDEM_SEVERIDADE.map((severidade) => {
          const lista = porSeveridade.get(severidade)
          if (!lista || lista.length === 0) return null
          const cor = COR_SEVERIDADE[severidade]
          return (
            <div key={severidade}>
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <span className="rounded-full px-2 py-0.5" style={{ background: cor.bg, color: cor.tx }}>
                  {severidade}
                </span>
                <span>({lista.length})</span>
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {lista.map((a) => {
                  const href = hrefDaEntidade(slug, a)
                  return (
                    <div
                      key={a.id}
                      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          {href ? (
                            <Link
                              href={href}
                              className="text-sm font-medium text-black underline dark:text-zinc-50"
                            >
                              {a.titulo}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium text-black dark:text-zinc-50">{a.titulo}</p>
                          )}
                          {a.estado === 'Adiado' && a.adiado_ate && (
                            <p className="mt-0.5 text-xs text-zinc-500">adiado até {a.adiado_ate}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {a.estado === 'Novo' && (
                          <form action={marcarVisto}>
                            <input type="hidden" name="estudio_slug" value={slug} />
                            <input type="hidden" name="id" value={a.id} />
                            <SubmitButton
                              pendingText="…"
                              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                            >
                              Marcar visto
                            </SubmitButton>
                          </form>
                        )}
                        <form action={resolverAlerta}>
                          <input type="hidden" name="estudio_slug" value={slug} />
                          <input type="hidden" name="id" value={a.id} />
                          <SubmitButton
                            pendingText="…"
                            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                          >
                            Resolver
                          </SubmitButton>
                        </form>
                        <details className="group">
                          <summary className="cursor-pointer list-none rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]">
                            Adiar…
                          </summary>
                          <form
                            action={adiarAlerta}
                            className="mt-2 flex items-center gap-2"
                          >
                            <input type="hidden" name="estudio_slug" value={slug} />
                            <input type="hidden" name="id" value={a.id} />
                            <input
                              type="date"
                              name="adiado_ate"
                              required
                              min={new Date().toISOString().slice(0, 10)}
                              className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-zinc-900"
                            />
                            <SubmitButton
                              pendingText="…"
                              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                            >
                              Confirmar
                            </SubmitButton>
                          </form>
                        </details>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
