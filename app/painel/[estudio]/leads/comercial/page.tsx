import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { PALETA } from '@/lib/data/constantes'
import {
  evolucaoSemanal,
  porOrigem,
  rankingComerciais,
  mapaDeCalorSemanaHora,
  type LeadParaRanking,
} from '@/lib/data/comercial'
import LineChart from '@/components/LineChart'
import BarMeter from '@/components/BarMeter'
import Heatmap from '@/components/Heatmap'

const SEMANAS = 8
const HORA_INICIO = 7
const HORA_FIM = 21

export default async function PainelComercialPage({
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

  const [sessao, pts] = await Promise.all([getSessaoAtual(), getEquipaDoEstudio(supabase, estudio.id)])
  const { ehAdmin } = papeisDaSessao(sessao)
  const hoje = new Date().toISOString().slice(0, 10)

  const { data: leadsData, error: erroLeads } = await supabase
    .from('leads')
    .select('id, estado, origem, responsavel_id, visita_marcada_em, valor_potencial, entrada, criado_em')
    .eq('estudio_id', estudio.id)

  if (erroLeads) {
    throw new Error(erroLeads.message)
  }

  const leads = leadsData ?? []
  const leadIds = leads.map((l) => l.id)

  const [{ data: historicoData, error: erroHistorico }, { data: contactosData, error: erroContactos }] =
    leadIds.length > 0
      ? await Promise.all([
          supabase
            .from('lead_stage_history')
            .select('lead_id, estado_novo, criado_em')
            .in('lead_id', leadIds),
          supabase
            .from('lead_contactos')
            .select('lead_id, criado_em, sucesso')
            .in('lead_id', leadIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]

  if (erroHistorico) throw new Error(erroHistorico.message)
  if (erroContactos) throw new Error(erroContactos.message)

  const historico = historicoData ?? []
  const contactos = contactosData ?? []

  // --- Evolução semanal ---
  const pontos = evolucaoSemanal(leads, historico, SEMANAS, hoje)

  // --- Leads por origem ---
  const origens = porOrigem(leads)

  // --- Ranking de comerciais ---
  const contactosPorLead = new Map<string, number>()
  for (const c of contactos) {
    contactosPorLead.set(c.lead_id, (contactosPorLead.get(c.lead_id) ?? 0) + 1)
  }
  const etapasPorLead = new Map<string, Set<string>>()
  for (const h of historico) {
    const set = etapasPorLead.get(h.lead_id) ?? new Set<string>()
    set.add(h.estado_novo)
    etapasPorLead.set(h.lead_id, set)
  }
  const leadsParaRanking: LeadParaRanking[] = leads.map((l) => ({
    responsavel_id: l.responsavel_id,
    estado: l.estado,
    visita_marcada_em: l.visita_marcada_em,
    valor_potencial: l.valor_potencial,
    contactos: contactosPorLead.get(l.id) ?? 0,
    alcancouExperimentalRealizada: etapasPorLead.get(l.id)?.has('Experimental realizada') ?? false,
  }))
  const ranking = rankingComerciais(leadsParaRanking, pts)

  // --- Mapa de calor: entradas de leads e contactos com sucesso ---
  const grelhaEntradas = mapaDeCalorSemanaHora(
    leads.map((l) => l.criado_em),
    HORA_INICIO,
    HORA_FIM
  )
  const grelhaContactos = mapaDeCalorSemanaHora(
    contactos.filter((c) => c.sucesso === true).map((c) => c.criado_em),
    HORA_INICIO,
    HORA_FIM
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/leads`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Painel comercial</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{estudio.nome}</p>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Evolução semanal · últimas {SEMANAS} semanas
        </h2>
        <div className="mt-2 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <LineChart
            rotulosEixoX={pontos.map((p) => p.semana.slice(5))}
            series={[
              { nome: 'Leads novas', cor: PALETA.azul.tx, valores: pontos.map((p) => p.novas) },
              { nome: 'Experimentais', cor: PALETA.roxo.tx, valores: pontos.map((p) => p.experimentais) },
              { nome: 'Vendas', cor: PALETA.verde.tx, valores: pontos.map((p) => p.vendas) },
            ]}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Leads por origem</h2>
        <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          {origens.length === 0 && <p className="text-sm text-muted">Sem leads registadas.</p>}
          {origens.map((o) => (
            <div key={o.origem}>
              <BarMeter label={o.origem} valor={o.total} total={origens[0].total} mostrarPct={false} />
              <p className="mt-0.5 text-right text-[11px] text-muted">
                {Math.round(o.taxaConversao * 100)}% de conversão
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Ranking de comerciais</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2">Comercial</th>
                <th className="px-3 py-2">Contactos</th>
                <th className="px-3 py-2">Agendamentos</th>
                <th className="px-3 py-2">Show rate</th>
                <th className="px-3 py-2">Fechos</th>
                {ehAdmin && <th className="px-3 py-2">Vendas</th>}
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.responsavelId} className="border-t border-border-subtle">
                  <td className="px-3 py-2 font-medium text-foreground">{r.nome}</td>
                  <td className="px-3 py-2 text-muted">{r.contactos}</td>
                  <td className="px-3 py-2 text-muted">{r.agendamentos}</td>
                  <td className="px-3 py-2 text-muted">
                    {r.showRate != null ? `${Math.round(r.showRate * 100)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.fechos}</td>
                  {ehAdmin && <td className="px-3 py-2 text-muted">€{r.vendasValor}</td>}
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={ehAdmin ? 6 : 5} className="px-3 py-4 text-center text-muted">
                    Sem leads atribuídas a um comercial.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Melhor hora · entradas de leads
          </h2>
          <div className="mt-2 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
            <Heatmap grelha={grelhaEntradas} horaInicio={HORA_INICIO} cor={PALETA.azul.tx} />
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Melhor hora · contactos com sucesso
          </h2>
          <div className="mt-2 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
            <Heatmap grelha={grelhaContactos} horaInicio={HORA_INICIO} cor={PALETA.verde.tx} />
          </div>
        </div>
      </div>
    </div>
  )
}
