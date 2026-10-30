import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'

export default async function PesquisaPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { estudio: slug } = await params
  const { q } = await searchParams
  const termo = q?.trim() ?? ''

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  let clientes: { id: string; nome: string; telefone: string | null; numero_socio: string | null }[] = []
  let leads: { id: string; nome: string; telefone: string | null; estado: string }[] = []
  let equipa: { id: string; nome: string }[] = []

  if (termo.length >= 2) {
    const padrao = `%${termo}%`
    const [{ data: clientesData }, { data: leadsData }, todaEquipa] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nome, telefone, numero_socio')
        .eq('estudio_id', estudio.id)
        .or(`nome.ilike.${padrao},telefone.ilike.${padrao},numero_socio.ilike.${padrao}`)
        .limit(15),
      supabase
        .from('leads')
        .select('id, nome, telefone, estado')
        .eq('estudio_id', estudio.id)
        .or(`nome.ilike.${padrao},telefone.ilike.${padrao}`)
        .limit(15),
      getEquipaDoEstudio(supabase, estudio.id),
    ])
    clientes = clientesData ?? []
    leads = leadsData ?? []
    const termoMinusculo = termo.toLowerCase()
    equipa = todaEquipa.filter((p) => p.nome.toLowerCase().includes(termoMinusculo))
  }

  const semResultados = termo.length >= 2 && clientes.length === 0 && leads.length === 0 && equipa.length === 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Pesquisar</h1>

      <form className="mt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={termo}
            autoFocus
            placeholder="Nome, telefone ou nº de cliente…"
            className="w-full rounded-full border border-black/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
      </form>

      {termo.length > 0 && termo.length < 2 && (
        <p className="mt-6 text-sm text-muted">Escreve pelo menos 2 letras.</p>
      )}

      {semResultados && <p className="mt-6 text-sm text-muted">Sem resultados para &quot;{termo}&quot;.</p>}

      {clientes.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Clientes ({clientes.length})
          </h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/painel/${slug}/clientes/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
              >
                <span className="text-black dark:text-zinc-50">{c.nome}</span>
                <span className="text-xs text-zinc-500">{c.telefone ?? c.numero_socio ?? ''}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {leads.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Leads ({leads.length})</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {leads.map((l) => (
              <Link
                key={l.id}
                href={`/painel/${slug}/leads/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
              >
                <span className="text-black dark:text-zinc-50">{l.nome}</span>
                <span className="text-xs text-zinc-500">{l.estado}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {equipa.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Equipa ({equipa.length})</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {equipa.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-black/10 bg-white p-3 text-sm text-black dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
              >
                {p.nome}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
