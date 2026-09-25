import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ALERTAS } from '@/lib/data/constantes'

function diasDesde(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default async function TreinosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { estudio: slug } = await params
  const { q } = await searchParams

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  // Uma única consulta: traz os clientes e, para cada um, apenas a
  // data do treino mais recente (embutido), em vez de duas consultas
  // separadas (clientes, depois sessões).
  let query = supabase
    .from('clientes')
    .select('id, nome, objetivo, alerta, sessoes(data)')
    .eq('estudio_id', estudio.id)
    .eq('estado', 'Ativo')
    .order('nome')
    .order('data', { referencedTable: 'sessoes', ascending: false })
    .limit(1, { referencedTable: 'sessoes' })

  if (q) {
    query = query.ilike('nome', `%${q}%`)
  }

  const { data: clientesData } = await query
  type ClienteComUltimoTreino = {
    id: string
    nome: string
    objetivo: string | null
    alerta: string
    sessoes: { data: string }[]
  }
  const clientes = (clientesData ?? []) as unknown as ClienteComUltimoTreino[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Treinos
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {estudio.nome} · {clientes.length} clientes ativos
          </p>
        </div>
        <Link
          href={`/painel/${slug}/treinos/novo`}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
        >
          + Cliente
        </Link>
      </div>

      <form method="get" className="mt-6">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Procurar cliente…"
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
        />
      </form>

      <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {clientes.map((c, i) => {
          const a = ALERTAS[c.alerta as keyof typeof ALERTAS] ?? ALERTAS.Nenhum
          const ultima = c.sessoes?.[0]?.data
          return (
            <Link
              key={c.id}
              href={`/painel/${slug}/treinos/${c.id}`}
              className={`flex flex-col gap-1.5 bg-white px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:bg-zinc-950 dark:hover:bg-white/[.05] ${
                i > 0 ? 'border-t border-black/10 dark:border-white/10' : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="flex min-w-[160px] flex-1 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.dot }} />
                  <span className="truncate font-medium text-black dark:text-zinc-50">
                    {c.nome}
                  </span>
                </span>
                {c.alerta !== 'Nenhum' && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: a.bg, color: a.tx }}
                  >
                    {a.label}
                  </span>
                )}
                <span className="shrink-0 text-xs text-zinc-500">
                  {ultima
                    ? diasDesde(ultima) === 0
                      ? 'Treinou hoje'
                      : diasDesde(ultima) === 1
                        ? 'Ontem'
                        : `Há ${diasDesde(ultima)} dias`
                    : 'Sem treinos registados'}
                </span>
              </div>
              {c.objetivo && <p className="text-xs text-zinc-500">{c.objetivo}</p>}
            </Link>
          )
        })}
      </div>

      {clientes.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {q ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes neste estúdio.'}
        </div>
      )}
    </div>
  )
}
