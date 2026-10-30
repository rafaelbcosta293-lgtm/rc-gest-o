import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { MESES, intervaloMes, fmt } from '@/lib/data/presencas'
import { PALETA } from '@/lib/data/constantes'
import { resumoMensalClientes, churnMensal } from '@/lib/data/retencao'
import { progressoFluxo, progressoStock, type Semaforo } from '@/lib/data/objetivos'
import StatCard from '@/components/StatCard'
import ImprimirButton from '@/components/ImprimirButton'
import type { Goal } from '@/lib/supabase/database.types'

const COR_SEMAFORO: Record<Semaforo, { bg: string; tx: string }> = {
  verde: PALETA.verde,
  ambar: PALETA.ambar,
  vermelho: PALETA.vermelho,
}

export default async function RelatorioMensalPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ ano?: string; mes?: string }>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const ano = Number(sp.ano) || Number(hoje.slice(0, 4))
  const mes = Number(sp.mes) || Number(hoje.slice(5, 7))
  const diaDoMes = `${ano}-${String(mes).padStart(2, '0')}` === hoje.slice(0, 7) ? Number(hoje.slice(8, 10)) : 31
  const diasDoMes = new Date(ano, mes, 0).getDate()
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)

  const [
    { data: leadsData, error: erroLeads },
    { data: clientesData, error: erroClientes },
    { data: atividadesData, error: erroAtividades },
    { data: alertasData, error: erroAlertas },
    { data: goalsData, error: erroGoals },
  ] = await Promise.all([
    supabase.from('leads').select('estado, entrada, fecho_em').eq('estudio_id', estudio.id),
    supabase.from('clientes').select('id, estado').eq('estudio_id', estudio.id),
    supabase
      .from('activities')
      .select('tipo, criado_em')
      .eq('estudio_id', estudio.id)
      .in('tipo', ['Cancelamento', 'Suspensão', 'Reativação']),
    supabase.from('alerts').select('severidade').eq('estudio_id', estudio.id).neq('estado', 'Resolvido'),
    supabase.from('goals').select('*').eq('estudio_id', estudio.id).eq('ano', ano).eq('mes', mes),
  ])

  for (const erro of [erroLeads, erroClientes, erroAtividades, erroAlertas, erroGoals]) {
    if (erro) throw new Error(erro.message)
  }

  const leadsNoMes = (leadsData ?? []).filter((l) => l.entrada >= inicio && l.entrada < fimExclusivo).length
  const vendasNoMes = (leadsData ?? []).filter(
    (l) => l.estado === 'Ganha' && l.fecho_em && l.fecho_em >= inicio && l.fecho_em < fimExclusivo
  ).length
  const clientesAtivos = (clientesData ?? []).filter((c) => c.estado === 'Ativo').length

  const resumoMes = resumoMensalClientes(
    (clientesData ?? []).map((c) => ({
      ...c,
      frequencia_semanal: null,
      inicio_contrato: null,
      fim_experiencia: null,
      saiu_em: null,
    })),
    atividadesData ?? [],
    inicio,
    fimExclusivo
  )
  const churn = churnMensal(clientesAtivos, resumoMes.cancelados)

  const alertasAbertos = alertasData ?? []
  const criticos = alertasAbertos.filter((a) => a.severidade === 'Crítico').length
  const atencao = alertasAbertos.filter((a) => a.severidade === 'Atenção').length

  const goals = (goalsData ?? []) as Goal[]
  const realizadoPorMetrica: Record<string, number> = {
    leads: leadsNoMes,
    vendas: vendasNoMes,
    clientes_ativos: clientesAtivos,
    churn: churn * 100,
  }
  const TIPO_FLUXO = new Set(['leads', 'vendas'])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/painel/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <ImprimirButton />
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Relatório mensal</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · {MESES[mes - 1]} {ano} · gerado em {fmt(hoje)}
      </p>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">KPIs principais</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Leads novas" valor={leadsNoMes} />
        <StatCard label="Vendas" valor={vendasNoMes} />
        <StatCard label="Clientes ativos" valor={clientesAtivos} />
        <StatCard
          cor={churn > 0.05 ? PALETA.vermelho : PALETA.verde}
          label="Churn mensal"
          valor={Math.round(churn * 100)}
          sufixo="%"
        />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Movimento de clientes</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard cor={PALETA.verde} label="Novos" valor={resumoMes.novos} />
        <StatCard cor={PALETA.vermelho} label="Cancelados" valor={resumoMes.cancelados} />
        <StatCard cor={PALETA.ambar} label="Suspensos" valor={resumoMes.suspensos} />
        <StatCard cor={PALETA.teal} label="Reativados" valor={resumoMes.reativados} />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Metas vs real</h2>
      {goals.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sem metas definidas para este mês.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {goals.map((g) => {
            const realizado = realizadoPorMetrica[g.metrica] ?? 0
            const progresso = TIPO_FLUXO.has(g.metrica)
              ? progressoFluxo(realizado, g.meta, diaDoMes, diasDoMes)
              : progressoStock(realizado, g.meta)
            const cor = COR_SEMAFORO[progresso.semaforo]
            return (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950"
              >
                <span className="text-black dark:text-zinc-50">{g.metrica}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">
                    {Math.round(realizado * 10) / 10} / {g.meta}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ background: cor.bg, color: cor.tx }}
                  >
                    {progresso.semaforo}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Alertas em aberto</h2>
      <div className="mt-2 flex gap-3">
        <StatCard cor={PALETA.vermelho} label="Críticos" valor={criticos} />
        <StatCard cor={PALETA.ambar} label="Atenção" valor={atencao} />
      </div>
      <Link
        href={`/painel/${slug}/alertas`}
        className="mt-2 inline-block text-xs text-muted underline hover:text-foreground print:hidden"
      >
        ver centro de alertas
      </Link>
    </div>
  )
}
