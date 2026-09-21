import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ESTADOS_LEAD } from '@/lib/data/constantes'
import { fmt } from '@/lib/data/presencas'
import type { Lead } from '@/lib/supabase/database.types'

const ORDEM_FUNIL = Object.keys(ESTADOS_LEAD) as (keyof typeof ESTADOS_LEAD)[]

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const { data, error } = await supabase
    .from('leads')
    .select('id, nome, telefone, estado, proximo_contacto')
    .eq('estudio_id', estudio.id)
    .order('proximo_contacto', { ascending: true, nullsFirst: false })

  if (error) {
    throw new Error(error.message)
  }

  const leads = (data ?? []) as Pick<Lead, 'id' | 'nome' | 'telefone' | 'estado' | 'proximo_contacto'>[]
  const hoje = new Date().toISOString().slice(0, 10)

  const porEstado = new Map<string, typeof leads>()
  for (const l of leads) {
    const lista = porEstado.get(l.estado) ?? []
    lista.push(l)
    porEstado.set(l.estado, lista)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Leads</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {estudio.nome} · {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
          </p>
        </div>
        <Link
          href={`/painel/${slug}/leads/novo`}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          + Lead
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {ORDEM_FUNIL.map((estado) => {
          const lista = porEstado.get(estado)
          if (!lista || lista.length === 0) return null
          const cor = ESTADOS_LEAD[estado]
          return (
            <div key={estado}>
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{ background: cor.bg, color: cor.tx }}
                >
                  {estado}
                </span>
                <span>({lista.length})</span>
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {lista.map((l) => {
                  const atrasado = l.proximo_contacto ? l.proximo_contacto <= hoje : false
                  return (
                    <Link
                      key={l.id}
                      href={`/painel/${slug}/leads/${l.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
                    >
                      <div>
                        <strong className="text-sm text-black dark:text-zinc-50">
                          {l.nome}
                        </strong>
                        {l.telefone && (
                          <p className="mt-0.5 text-xs text-zinc-500">{l.telefone}</p>
                        )}
                      </div>
                      {l.proximo_contacto && (
                        <span
                          className={`text-xs font-medium ${
                            atrasado ? 'text-red-600' : 'text-zinc-500'
                          }`}
                        >
                          {atrasado ? 'contactar: ' : 'contacto em '}
                          {fmt(l.proximo_contacto)}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {leads.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há leads registados.
        </div>
      )}
    </div>
  )
}
