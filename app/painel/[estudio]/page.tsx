import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { MODULOS } from '@/lib/data/constantes'

export default async function EstudioPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params
  const supabase = await createClient()

  const [estudio, { data: userData }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.auth.getUser(),
  ])
  if (!estudio) {
    notFound()
  }

  const [{ data: perfil }, { data: clientes }] = await Promise.all([
    userData.user
      ? supabase.from('perfis').select('papel').eq('id', userData.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('clientes').select('estado').eq('estudio_id', estudio.id),
  ])

  const ehGestao = perfil?.papel === 'admin' || perfil?.papel === 'studio_manager'

  const ativos = (clientes ?? []).filter((c) => c.estado === 'Ativo').length

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Estúdio de {estudio.nome}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Escolhe a área onde queres trabalhar.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {ehGestao && (
            <Link
              href={`/painel/${slug}/equipa`}
              className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
            >
              Equipa
            </Link>
          )}
          <Link
            href="/painel"
            className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
          >
            ⇄ Mudar estúdio
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {MODULOS.map((m) =>
          m.pronto ? (
            <Link
              key={m.id}
              href={`/painel/${slug}/${m.id}`}
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
