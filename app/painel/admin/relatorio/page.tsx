import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import { MESES, intervaloMes, fmt } from '@/lib/data/presencas'
import { PALETA, corEstudio } from '@/lib/data/constantes'
import { resumoMensalClientes, churnMensal } from '@/lib/data/retencao'
import { mrrAtual, receitaPorMes } from '@/lib/data/financeiro'
import StatCard from '@/components/StatCard'
import BarMeter from '@/components/BarMeter'
import ImprimirButton from '@/components/ImprimirButton'
import PortaSenha from '@/components/PortaSenha'

export default async function RelatorioConsolidadoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string; erroSenha?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Relatório"
        destino="/painel/admin/relatorio"
        action={desbloquearAdmin}
        erro={sp.erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)
  const hoje = new Date().toISOString().slice(0, 10)
  const ano = Number(sp.ano) || Number(hoje.slice(0, 4))
  const mes = Number(sp.mes) || Number(hoje.slice(5, 7))
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)

  const [
    { data: leadsData, error: erroLeads },
    { data: clientesData, error: erroClientes },
    { data: atividadesData, error: erroAtividades },
    { data: alertasData, error: erroAlertas },
    { data: pagamentosData, error: erroPagamentos },
  ] = await Promise.all([
    supabase.from('leads').select('estudio_id, estado, entrada, fecho_em'),
    supabase.from('clientes').select('id, estudio_id, estado'),
    supabase.from('activities').select('tipo, criado_em').in('tipo', ['Cancelamento', 'Suspensão', 'Reativação']),
    supabase.from('alerts').select('severidade').neq('estado', 'Resolvido'),
    supabase.from('pagamentos').select('cliente_id, valor, data_pagamento, valido_ate').gte('data_pagamento', inicio),
  ])

  for (const erro of [erroLeads, erroClientes, erroAtividades, erroAlertas, erroPagamentos]) {
    if (erro) throw new Error(erro.message)
  }

  const clientes = clientesData ?? []
  const leads = leadsData ?? []
  const maisRecentePorCliente = new Map<string, { valor: number; valido_ate: string }>()
  for (const p of pagamentosData ?? []) {
    if (!maisRecentePorCliente.has(p.cliente_id)) {
      maisRecentePorCliente.set(p.cliente_id, { valor: p.valor, valido_ate: p.valido_ate })
    }
  }
  const mrr = mrrAtual(Array.from(maisRecentePorCliente.values()), hoje)
  const receitaDoMes = receitaPorMes(pagamentosData ?? [], [`${ano}-${String(mes).padStart(2, '0')}`])[0] ?? 0

  const alertasAbertos = alertasData ?? []
  const criticos = alertasAbertos.filter((a) => a.severidade === 'Crítico').length

  const linhasPorEstudio = estudios.map((e) => {
    const leadsDoEstudio = leads.filter((l) => l.estudio_id === e.id)
    const clientesDoEstudio = clientes.filter((c) => c.estudio_id === e.id)
    const ativos = clientesDoEstudio.filter((c) => c.estado === 'Ativo').length
    const leadsNoMes = leadsDoEstudio.filter((l) => l.entrada >= inicio && l.entrada < fimExclusivo).length
    const vendasNoMes = leadsDoEstudio.filter(
      (l) => l.estado === 'Ganha' && l.fecho_em && l.fecho_em >= inicio && l.fecho_em < fimExclusivo
    ).length
    const resumo = resumoMensalClientes(
      clientesDoEstudio.map((c) => ({
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
    return {
      estudio: e,
      ativos,
      leadsNoMes,
      vendasNoMes,
      churn: churnMensal(ativos, resumo.cancelados),
    }
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/painel/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Administração
        </Link>
        <ImprimirButton />
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Relatório mensal consolidado
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Fátima + Leiria · {MESES[mes - 1]} {ano} · gerado em {fmt(hoje)}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="MRR" valor={`€${Math.round(mrr)}`} />
        <StatCard label="Receita cobrada" valor={`€${Math.round(receitaDoMes)}`} />
        <StatCard
          label="Leads novas"
          valor={linhasPorEstudio.reduce((s, l) => s + l.leadsNoMes, 0)}
        />
        <StatCard cor={criticos > 0 ? PALETA.vermelho : PALETA.verde} label="Alertas críticos" valor={criticos} />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Por estúdio</h2>
      <div className="mt-2 flex flex-col gap-3">
        {linhasPorEstudio.map((l) => (
          <div
            key={l.estudio.id}
            className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: corEstudio(l.estudio.slug).cor }} />
              {l.estudio.nome}
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              <BarMeter label="Leads novas" valor={l.leadsNoMes} total={Math.max(1, l.leadsNoMes)} mostrarPct={false} />
              <BarMeter label="Vendas" valor={l.vendasNoMes} total={Math.max(1, l.leadsNoMes)} mostrarPct={false} />
              <BarMeter label="Clientes ativos" valor={l.ativos} total={Math.max(1, l.ativos)} mostrarPct={false} />
            </div>
            <p className="mt-2 text-xs text-muted">Churn mensal (aproximado): {Math.round(l.churn * 100)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
