import Link from 'next/link'
import { ArrowLeft, TrendingUp, Clock3, UserCheck } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { somarDias } from '@/lib/data/horarios'
import { ESTADOS_LEAD } from '@/lib/data/constantes'
import { calcularMetricasFunil, type HistoricoEtapaLinha } from '@/lib/data/funil'
import StatCard from '@/components/StatCard'
import BarMeter from '@/components/BarMeter'
import LeadsKanban, { type LeadResumo } from './LeadsKanban'

const ORDEM_FUNIL = Object.keys(ESTADOS_LEAD) as (keyof typeof ESTADOS_LEAD)[]
const JANELA_FUNIL_DIAS = 90

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

  const [{ data, error }, pts] = await Promise.all([
    supabase
      .from('leads')
      .select(
        'id, nome, telefone, estado, origem, temperatura, responsavel_id, proximo_contacto, visita_data, visita_hora, valor_potencial, entrada, responsavel:perfis!responsavel_id(nome)'
      )
      .eq('estudio_id', estudio.id)
      .order('proximo_contacto', { ascending: true, nullsFirst: false }),
    getEquipaDoEstudio(supabase, estudio.id),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const leads = (data ?? []) as unknown as LeadResumo[]
  const hoje = new Date().toISOString().slice(0, 10)

  const leadIds = leads.map((l) => l.id)
  let historico: HistoricoEtapaLinha[] = []
  if (leadIds.length > 0) {
    const { data: historicoData, error: erroHistorico } = await supabase
      .from('lead_stage_history')
      .select('lead_id, estado_anterior, estado_novo, criado_em')
      .in('lead_id', leadIds)
    if (erroHistorico) {
      throw new Error(erroHistorico.message)
    }
    historico = historicoData ?? []
  }

  const limiteFunil = somarDias(hoje, -JANELA_FUNIL_DIAS)
  const leadsNoFunil = leads.filter((l) => l.entrada >= limiteFunil).map((l) => l.id)
  const funil = calcularMetricasFunil(leadsNoFunil, historico, ORDEM_FUNIL)

  const emAberto = (l: LeadResumo) => l.estado !== 'Ganha' && l.estado !== 'Perdida'
  const visitasHoje = leads.filter((l) => emAberto(l) && l.visita_data === hoje)
  const contactosHoje = leads.filter(
    (l) => emAberto(l) && l.proximo_contacto && l.proximo_contacto <= hoje && l.visita_data !== hoje
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Leads</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {estudio.nome} · {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/painel/${slug}/leads/importar`}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
          >
            Importar CSV
          </Link>
          <Link
            href={`/painel/${slug}/leads/novo`}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
          >
            + Lead
          </Link>
        </div>
      </div>

      {funil.total > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Funil · últimos {JANELA_FUNIL_DIAS} dias
          </h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icone={TrendingUp}
              label="Taxa de conversão"
              valor={Math.round(funil.taxaConversao * 100)}
              sufixo="%"
            />
            <StatCard
              icone={UserCheck}
              label="Comparecimento à experimental"
              valor={funil.taxaComparecimento != null ? Math.round(funil.taxaComparecimento * 100) : '—'}
              sufixo={funil.taxaComparecimento != null ? '%' : undefined}
            />
            <StatCard
              icone={Clock3}
              label="Até ao 1º contacto"
              valor={
                funil.horasMediasPrimeiroContacto != null
                  ? Math.round(funil.horasMediasPrimeiroContacto)
                  : '—'
              }
              sufixo={funil.horasMediasPrimeiroContacto != null ? 'h' : undefined}
            />
          </div>
          <div className="mt-3 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
            {ORDEM_FUNIL.map((etapa) => (
              <BarMeter
                key={etapa}
                label={etapa}
                valor={funil.porEtapa[etapa] ?? 0}
                total={funil.total}
                cor={ESTADOS_LEAD[etapa].tx}
              />
            ))}
          </div>
        </div>
      )}

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

      {leads.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há leads registados.
        </div>
      ) : (
        <LeadsKanban estudioSlug={slug} leads={leads} pts={pts} />
      )}
    </div>
  )
}
