import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ESTADOS_LEAD } from '@/lib/data/constantes'
import { fmt } from '@/lib/data/presencas'
import { diasDesde } from '@/lib/data/leads'
import type { Lead } from '@/lib/supabase/database.types'

const ORDEM_FUNIL = Object.keys(ESTADOS_LEAD) as (keyof typeof ESTADOS_LEAD)[]

type LeadResumo = Pick<
  Lead,
  | 'id'
  | 'nome'
  | 'telefone'
  | 'estado'
  | 'proximo_contacto'
  | 'visita_data'
  | 'visita_hora'
  | 'valor_potencial'
  | 'entrada'
> & { responsavel: { nome: string } | null }

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
    .select(
      'id, nome, telefone, estado, proximo_contacto, visita_data, visita_hora, valor_potencial, entrada, responsavel:perfis!responsavel_id(nome)'
    )
    .eq('estudio_id', estudio.id)
    .order('proximo_contacto', { ascending: true, nullsFirst: false })

  if (error) {
    throw new Error(error.message)
  }

  const leads = (data ?? []) as unknown as LeadResumo[]
  const hoje = new Date().toISOString().slice(0, 10)

  const emAberto = (l: LeadResumo) => l.estado !== 'Convertido' && l.estado !== 'Perdido'
  const visitasHoje = leads.filter((l) => emAberto(l) && l.visita_data === hoje)
  const contactosHoje = leads.filter(
    (l) => emAberto(l) && l.proximo_contacto && l.proximo_contacto <= hoje && l.visita_data !== hoje
  )

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

      {(visitasHoje.length > 0 || contactosHoje.length > 0) && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            Para hoje
          </h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {visitasHoje.map((l) => (
              <Link
                key={`visita-${l.id}`}
                href={`/painel/${slug}/leads/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm transition-colors hover:bg-white/70 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <span className="text-black dark:text-zinc-50">{l.nome}</span>
                <span className="text-xs font-medium text-[#5B3FA0]">
                  Visita{l.visita_hora ? ` às ${l.visita_hora.slice(0, 5)}` : ''}
                </span>
              </Link>
            ))}
            {contactosHoje.map((l) => {
              const atrasado = l.proximo_contacto! < hoje
              return (
                <Link
                  key={`contacto-${l.id}`}
                  href={`/painel/${slug}/leads/${l.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm transition-colors hover:bg-white/70 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <span className="text-black dark:text-zinc-50">{l.nome}</span>
                  <span className={`text-xs font-medium ${atrasado ? 'text-red-600' : 'text-amber-700 dark:text-amber-400'}`}>
                    Contactar {atrasado ? '(em atraso)' : 'hoje'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

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
                      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
                            className={`shrink-0 text-xs font-medium ${
                              atrasado ? 'text-red-600' : 'text-zinc-500'
                            }`}
                          >
                            {atrasado ? 'contactar: ' : 'contacto em '}
                            {fmt(l.proximo_contacto)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                        <span>há {diasDesde(l.entrada)} dias</span>
                        {l.responsavel && <span>· {l.responsavel.nome}</span>}
                        {l.valor_potencial != null && <span>· €{l.valor_potencial}</span>}
                        {l.visita_data && (
                          <span className="rounded-full bg-[#E9E5F7] px-2 py-0.5 font-medium text-[#5B3FA0]">
                            Visita {fmt(l.visita_data)}
                            {l.visita_hora ? ` ${l.visita_hora.slice(0, 5)}` : ''}
                          </span>
                        )}
                      </div>
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
