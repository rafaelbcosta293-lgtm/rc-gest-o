import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ESTUDIOS, MODULOS, estudioDe } from '@/lib/data/constantes'

export default async function EstudioPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio } = await params
  if (!ESTUDIOS.some((e) => e.id === estudio)) {
    notFound()
  }
  const info = estudioDe(estudio)

  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('estado')
    .eq('estudio', estudio)

  const ativos = (clientes ?? []).filter((c) => c.estado === 'Ativo').length

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Estúdio de {info.nome}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Escolhe a área onde queres trabalhar.
          </p>
        </div>
        <Link
          href="/painel"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          ⇄ Mudar estúdio
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {MODULOS.map((m) =>
          m.pronto ? (
            <Link
              key={m.id}
              href={`/painel/${estudio}/${m.id}`}
              className="rounded-xl border border-black/10 bg-white p-5 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
            >
              <span className="text-2xl">{m.icone}</span>
              <h2 className="mt-2 font-semibold text-black dark:text-zinc-50">
                {m.nome}
              </h2>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{m.desc}</p>
              {m.id === 'treinos' && (
                <p className="mt-3 text-xs font-medium text-teal-700 dark:text-teal-400">
                  {ativos} {ativos === 1 ? 'cliente ativo' : 'clientes ativos'}
                </p>
              )}
            </Link>
          ) : (
            <div
              key={m.id}
              className="rounded-xl border border-dashed border-black/10 bg-white/50 p-5 opacity-60 dark:border-white/10 dark:bg-zinc-950/50"
            >
              <span className="text-2xl">{m.icone}</span>
              <h2 className="mt-2 font-semibold text-black dark:text-zinc-50">
                {m.nome}
              </h2>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{m.desc}</p>
              <p className="mt-3 text-xs font-medium text-zinc-400">Brevemente</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
