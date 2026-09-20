import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ALERTAS, ESTUDIOS, estudioDe } from '@/lib/data/constantes'

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
  const { estudio } = await params
  if (!ESTUDIOS.some((e) => e.id === estudio)) {
    notFound()
  }
  const { q } = await searchParams

  const supabase = await createClient()

  let query = supabase
    .from('clientes')
    .select('id, nome, objetivo, alerta')
    .eq('estudio', estudio)
    .eq('estado', 'Ativo')
    .order('nome')

  if (q) {
    query = query.ilike('nome', `%${q}%`)
  }

  const { data: clientes } = await query

  const ids = (clientes ?? []).map((c) => c.id)
  const { data: sessoes } = ids.length
    ? await supabase
        .from('sessoes')
        .select('cliente_id, data')
        .in('cliente_id', ids)
        .order('data', { ascending: false })
    : { data: [] }

  const ultimaPorCliente = new Map<string, string>()
  for (const s of sessoes ?? []) {
    if (!ultimaPorCliente.has(s.cliente_id)) ultimaPorCliente.set(s.cliente_id, s.data)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${estudio}`}
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
            {estudioDe(estudio).nome} · {(clientes ?? []).length} clientes ativos
          </p>
        </div>
        <Link
          href={`/painel/${estudio}/treinos/novo`}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
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
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
        />
      </form>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(clientes ?? []).map((c) => {
          const a = ALERTAS[c.alerta as keyof typeof ALERTAS] ?? ALERTAS.Nenhum
          const ultima = ultimaPorCliente.get(c.id)
          return (
            <Link
              key={c.id}
              href={`/painel/${estudio}/treinos/${c.id}`}
              className="rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: a.dot }}
                />
                <span className="font-medium text-black dark:text-zinc-50">
                  {c.nome}
                </span>
              </div>
              {c.objetivo && (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {c.objetivo}
                </p>
              )}
              {c.alerta !== 'Nenhum' && (
                <span
                  className="mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: a.bg, color: a.tx }}
                >
                  {a.label}
                </span>
              )}
              <p className="mt-2 border-t border-black/5 pt-2 text-xs text-zinc-500 dark:border-white/5">
                {ultima
                  ? diasDesde(ultima) === 0
                    ? 'Treinou hoje'
                    : diasDesde(ultima) === 1
                      ? 'Ontem'
                      : `Há ${diasDesde(ultima)} dias`
                  : 'Sem treinos registados'}
              </p>
            </Link>
          )
        })}
      </div>

      {(clientes ?? []).length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {q ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes neste estúdio.'}
        </div>
      )}
    </div>
  )
}
