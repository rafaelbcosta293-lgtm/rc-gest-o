import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ALERTAS, CORREU, ESTUDIOS } from '@/lib/data/constantes'
import type { Sessao } from '@/lib/supabase/database.types'

function fmt(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
}) {
  const { estudio, clienteId } = await params
  if (!ESTUDIOS.some((e) => e.id === estudio)) {
    notFound()
  }

  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .eq('estudio', estudio)
    .maybeSingle()

  if (!cliente) {
    notFound()
  }

  const { data: sessoes } = await supabase
    .from('sessoes')
    .select('*, pt:profiles(nome)')
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false })

  const lista = (sessoes ?? []) as unknown as (Sessao & { pt: { nome: string } | null })[]
  const ultima = lista[0]
  const a = ALERTAS[cliente.alerta as keyof typeof ALERTAS] ?? ALERTAS.Nenhum

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${estudio}/treinos`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Treinos
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {cliente.nome}
          </h1>
          {cliente.objetivo && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {cliente.objetivo}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/painel/${estudio}/treinos/${clienteId}/editar`}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
          >
            Editar ficha
          </Link>
          <Link
            href={`/painel/${estudio}/treinos/${clienteId}/treino/novo`}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Planear treino
          </Link>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border-2 border-black/10 dark:border-white/10">
        <div
          className="px-4 py-2.5 text-sm"
          style={{ background: a.bg, color: a.tx }}
        >
          <strong>{a.label}</strong>
          {cliente.detalhe && <span> — {cliente.detalhe}</span>}
        </div>
        {cliente.evento && (
          <div className="bg-purple-50 px-4 py-2 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            🏁 {cliente.evento}
            {cliente.evento_data && <> — {fmt(cliente.evento_data)}</>}
          </div>
        )}
        <div className="bg-white p-4 dark:bg-zinc-950">
          {ultima?.nota_proxima ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                Nota do último treino · {fmt(ultima.data)} · {ultima.pt?.nome ?? '—'}
              </div>
              <p className="mt-2 text-base font-medium text-black dark:text-zinc-50">
                {ultima.nota_proxima}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              O primeiro treino que registares deixa aqui a nota para o próximo PT.
            </p>
          )}
        </div>
      </section>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico de treinos
      </h2>

      {lista.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há treinos registados para {cliente.nome}.
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {lista.map((s) => {
          const cc = s.correu
            ? (CORREU[s.correu as keyof typeof CORREU] ?? { bg: '#F2F5FA', tx: '#6B7688' })
            : { bg: '#F2F5FA', tx: '#6B7688' }
          return (
            <Link
              key={s.id}
              href={`/painel/${estudio}/treinos/${clienteId}/treino/${s.id}`}
              className="flex gap-4 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="min-w-[70px] pt-0.5 text-xs text-zinc-500">
                {fmt(s.data)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-black dark:text-zinc-50">
                    {s.foco || 'Treino'}
                  </strong>
                  {s.correu && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: cc.bg, color: cc.tx }}
                    >
                      {s.correu}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">{s.pt?.nome ?? '—'}</span>
                </div>
                {s.nota_proxima && (
                  <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    ⚑ {s.nota_proxima}
                  </p>
                )}
                {s.exercicios?.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {s.exercicios.length} exercícios
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
