import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { intervaloMes } from '@/lib/data/presencas'
import { somarDias } from '@/lib/data/horarios'
import { PALETA, ESTADOS_LEAD } from '@/lib/data/constantes'
import { resumoMensalClientes, churnMensal } from '@/lib/data/retencao'
import { calcularMetricasFunil } from '@/lib/data/funil'
import { ocupacaoPorPt } from '@/lib/data/operacional'
import { mrrAtual } from '@/lib/data/financeiro'
import { progressoFluxo, progressoStock, type Semaforo } from '@/lib/data/objetivos'
import { definirMeta, apagarMeta } from './actions'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import FunilInversoForm from './FunilInversoForm'
import type { Goal } from '@/lib/supabase/database.types'

const ORDEM_FUNIL = Object.keys(ESTADOS_LEAD) as (keyof typeof ESTADOS_LEAD)[]
const JANELA_FUNIL_DIAS = 90

type MetricaChave = 'leads' | 'vendas' | 'clientes_ativos' | 'churn' | 'show_rate' | 'ocupacao_pt' | 'mrr'

const METRICAS: { chave: MetricaChave; label: string; tipo: 'fluxo' | 'stock'; sufixo?: string; soAdmin?: boolean }[] = [
  { chave: 'leads', label: 'Leads novas', tipo: 'fluxo' },
  { chave: 'vendas', label: 'Vendas (leads ganhas)', tipo: 'fluxo' },
  { chave: 'clientes_ativos', label: 'Clientes ativos', tipo: 'stock' },
  { chave: 'churn', label: 'Churn mensal', tipo: 'stock', sufixo: '%' },
  { chave: 'show_rate', label: 'Show rate', tipo: 'stock', sufixo: '%' },
  { chave: 'ocupacao_pt', label: 'Ocupação de PT', tipo: 'stock', sufixo: '%' },
  { chave: 'mrr', label: 'MRR', tipo: 'stock', sufixo: '€', soAdmin: true },
]

const COR_SEMAFORO: Record<Semaforo, { bg: string; tx: string }> = {
  verde: PALETA.verde,
  ambar: PALETA.ambar,
  vermelho: PALETA.vermelho,
}

export default async function ObjetivosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }
  const { ehAdmin } = papeisDaSessao(sessao)

  const hoje = new Date().toISOString().slice(0, 10)
  const ano = Number(hoje.slice(0, 4))
  const mes = Number(hoje.slice(5, 7))
  const diaDoMes = Number(hoje.slice(8, 10))
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)
  const diasDoMes = new Date(ano, mes, 0).getDate()

  const { data: goalsData, error: erroGoals } = await supabase
    .from('goals')
    .select('*')
    .eq('estudio_id', estudio.id)
    .eq('ano', ano)
    .eq('mes', mes)
  if (erroGoals) throw new Error(erroGoals.message)
  const goals = (goalsData ?? []) as Goal[]
  const metaPorChave = new Map(goals.map((g) => [g.metrica, g]))

  // --- Dados do mês, só o necessário para as métricas com meta definida ---
  const [
    { data: leadsDoMes, error: erroLeadsMes },
    { data: clientesData, error: erroClientes },
  ] = await Promise.all([
    supabase.from('leads').select('estado, entrada, fecho_em').eq('estudio_id', estudio.id),
    supabase.from('clientes').select('id, estado').eq('estudio_id', estudio.id),
  ])
  if (erroLeadsMes) throw new Error(erroLeadsMes.message)
  if (erroClientes) throw new Error(erroClientes.message)

  const leadsNoMes = (leadsDoMes ?? []).filter((l) => l.entrada >= inicio && l.entrada < fimExclusivo).length
  const vendasNoMes = (leadsDoMes ?? []).filter(
    (l) => l.estado === 'Ganha' && l.fecho_em && l.fecho_em >= inicio && l.fecho_em < fimExclusivo
  ).length
  const clientesAtivos = (clientesData ?? []).filter((c) => c.estado === 'Ativo').length

  let churnPct: number | null = null
  if (metaPorChave.has('churn')) {
    const { data: atividadesData } = await supabase
      .from('activities')
      .select('tipo, criado_em')
      .eq('estudio_id', estudio.id)
      .in('tipo', ['Cancelamento'])
    const resumo = resumoMensalClientes(
      (clientesData ?? []).map((c) => ({ ...c, frequencia_semanal: null, inicio_contrato: null, fim_experiencia: null, saiu_em: null })),
      atividadesData ?? [],
      inicio,
      fimExclusivo
    )
    churnPct = churnMensal(clientesAtivos, resumo.cancelados) * 100
  }

  let showRatePct: number | null = null
  if (metaPorChave.has('show_rate')) {
    const leadsDoMesIds = (
      await supabase.from('leads').select('id').eq('estudio_id', estudio.id).gte('entrada', inicio).lt('entrada', fimExclusivo)
    ).data?.map((l) => l.id) ?? []
    if (leadsDoMesIds.length > 0) {
      const { data: historicoData } = await supabase
        .from('lead_stage_history')
        .select('lead_id, estado_anterior, estado_novo, criado_em')
        .in('lead_id', leadsDoMesIds)
      const metricas = calcularMetricasFunil(leadsDoMesIds, historicoData ?? [], ORDEM_FUNIL)
      showRatePct = metricas.taxaComparecimento != null ? metricas.taxaComparecimento * 100 : null
    }
  }

  let ocupacaoPct: number | null = null
  if (metaPorChave.has('ocupacao_pt')) {
    const [{ data: registosData }, { data: escalasData }, { data: ptsData }] = await Promise.all([
      supabase.from('registos_pt').select('pt_id, horas, treinos_40, treinos_60').eq('estudio_id', estudio.id).gte('data', inicio).lt('data', fimExclusivo),
      supabase.from('escalas').select('pt_id').eq('estudio_id', estudio.id).gte('data', inicio).lt('data', fimExclusivo),
      supabase.from('perfis_estudios').select('perfil:perfis!perfil_id(id, nome)').eq('estudio_id', estudio.id),
    ])
    const pts = (ptsData ?? [])
      .map((p) => p.perfil as unknown as { id: string; nome: string } | null)
      .filter((p): p is { id: string; nome: string } => p !== null)
    const ocupacoes = ocupacaoPorPt(registosData ?? [], escalasData ?? [], pts).filter((o) => o.ocupacao != null)
    ocupacaoPct =
      ocupacoes.length > 0
        ? (ocupacoes.reduce((soma, o) => soma + (o.ocupacao ?? 0), 0) / ocupacoes.length) * 100
        : null
  }

  let mrrValor: number | null = null
  if (ehAdmin && metaPorChave.has('mrr')) {
    const { data: pagamentosData } = await supabase
      .from('pagamentos')
      .select('cliente_id, valor, valido_ate')
      .order('data_pagamento', { ascending: false })
    const maisRecentePorCliente = new Map<string, { valor: number; valido_ate: string }>()
    for (const p of pagamentosData ?? []) {
      if (!maisRecentePorCliente.has(p.cliente_id)) {
        maisRecentePorCliente.set(p.cliente_id, { valor: p.valor, valido_ate: p.valido_ate })
      }
    }
    mrrValor = mrrAtual(Array.from(maisRecentePorCliente.values()), hoje)
  }

  const realizadoPorChave: Record<MetricaChave, number | null> = {
    leads: leadsNoMes,
    vendas: vendasNoMes,
    clientes_ativos: clientesAtivos,
    churn: churnPct,
    show_rate: showRatePct,
    ocupacao_pt: ocupacaoPct,
    mrr: mrrValor,
  }

  // --- Funil inverso: últimos 90 dias ---
  const limiteFunil = somarDias(hoje, -JANELA_FUNIL_DIAS)
  const { data: leadsRecentes } = await supabase
    .from('leads')
    .select('id, entrada')
    .eq('estudio_id', estudio.id)
    .gte('entrada', limiteFunil)
  const idsRecentes = (leadsRecentes ?? []).map((l) => l.id)
  let funilRecente = { total: 0, porEtapa: {} as Record<string, number> }
  let contactosRecentes = 0
  if (idsRecentes.length > 0) {
    const [{ data: historicoRecente }, { count: contactosCount }] = await Promise.all([
      supabase.from('lead_stage_history').select('lead_id, estado_anterior, estado_novo, criado_em').in('lead_id', idsRecentes),
      supabase.from('lead_contactos').select('id', { count: 'exact', head: true }).in('lead_id', idsRecentes),
    ])
    funilRecente = calcularMetricasFunil(idsRecentes, historicoRecente ?? [], ORDEM_FUNIL)
    contactosRecentes = contactosCount ?? 0
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">Objetivos</h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · {mes}/{ano} · dia {diaDoMes} de {diasDoMes}
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {METRICAS.filter((m) => !m.soAdmin || ehAdmin).map((m) => {
          const goal = metaPorChave.get(m.chave)
          const realizado = realizadoPorChave[m.chave]
          if (!goal) return null

          const progresso =
            m.tipo === 'fluxo'
              ? progressoFluxo(realizado ?? 0, goal.meta, diaDoMes, diasDoMes)
              : progressoStock(realizado ?? 0, goal.meta)
          const cor = COR_SEMAFORO[progresso.semaforo]

          return (
            <div
              key={m.chave}
              className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{m.label}</h2>
                  <p className="mt-1 font-mono text-lg tabular-nums text-foreground">
                    {realizado != null ? Math.round(realizado * 10) / 10 : '—'}
                    {m.sufixo} <span className="text-sm text-muted">/ {goal.meta}{m.sufixo}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: cor.bg, color: cor.tx }}
                  >
                    {progresso.semaforo}
                  </span>
                  <ConfirmarAcao
                    action={apagarMeta}
                    confirmacao={`Tens a certeza que queres apagar a meta "${m.label}"?`}
                  >
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="id" value={goal.id} />
                    <button type="submit" aria-label="Apagar meta" className="rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </ConfirmarAcao>
                </div>
              </div>
              {progresso.tipo === 'fluxo' && (
                <p className="mt-2 text-xs text-muted">
                  Projeção ao ritmo atual: {Math.round(progresso.projecaoFimDoMes)}
                  {m.sufixo}
                  {progresso.ritmoDiarioNecessario != null && progresso.ritmoDiarioNecessario > 0 && (
                    <> · precisas de {progresso.ritmoDiarioNecessario.toFixed(1)}{m.sufixo}/dia até ao fim do mês</>
                  )}
                </p>
              )}
            </div>
          )
        })}
        {goals.length === 0 && (
          <p className="text-sm text-muted">Ainda não há metas definidas para este mês.</p>
        )}
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Definir/atualizar meta</h2>
      <form action={definirMeta} className="mt-2 flex flex-wrap items-end gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="estudio_id" value={estudio.id} />
        <input type="hidden" name="ano" value={ano} />
        <input type="hidden" name="mes" value={mes} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Métrica</label>
          <select name="metrica" className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900">
            {METRICAS.filter((m) => !m.soAdmin || ehAdmin).map((m) => (
              <option key={m.chave} value={m.chave}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Meta</label>
          <input
            type="number"
            name="meta"
            step="any"
            required
            className="w-32 rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
          />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
        >
          Guardar
        </SubmitButton>
      </form>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">
        Calculadora de funil inverso
      </h2>
      <p className="mt-1 text-xs text-muted">
        Usa as taxas reais dos últimos {JANELA_FUNIL_DIAS} dias. Sem custo de marketing por lead
        registado, não há CAC real para estimar o investimento necessário — fica de fora.
      </p>
      <FunilInversoForm funil={funilRecente} contactosRecentes={contactosRecentes} />
    </div>
  )
}
