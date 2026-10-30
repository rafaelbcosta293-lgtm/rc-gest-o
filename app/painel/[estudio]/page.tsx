import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UsersRound, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { PALETA } from '@/lib/data/constantes'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { segurosPorPagar } from '@/lib/data/clientes'
import StatCard from '@/components/StatCard'
import RadialProgress from '@/components/RadialProgress'
import AgendaConteudo from './agenda/AgendaConteudo'

export default async function EstudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ vista?: string; data?: string; pt?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }

  // Estas três só precisam do estúdio, não umas das outras — correm
  // todas ao mesmo tempo em vez de à vez.
  const [{ data: clientes }, { data: pagamentosEstadoData }, { data: leadsParadasData }] = await Promise.all([
    supabase.from('clientes').select('id, estado, inicio_contrato').eq('estudio_id', estudio.id),
    supabase.from('v_estado_pagamento').select('em_dia').eq('estudio_id', estudio.id),
    supabase.from('v_leads_paradas').select('id').eq('estudio_id', estudio.id),
  ])

  const { ehGestao } = papeisDaSessao(sessao)

  const todosClientes = clientes ?? []
  const ativos = todosClientes.filter((c) => c.estado === 'Ativo').length

  const mensalidadesEmDivida = (pagamentosEstadoData ?? []).filter((p) => !p.em_dia).length
  const leadsContactoAtrasado = (leadsParadasData ?? []).length

  // Estas duas só precisam dos ids dos clientes ativos — também correm
  // em paralelo entre si.
  const clientesAtivos = todosClientes.filter((c) => c.estado === 'Ativo')
  const idsClientesAtivos = clientesAtivos.map((c) => c.id)
  const [{ data: segurosPagosData }, { data: reativacoesData }] = idsClientesAtivos.length
    ? await Promise.all([
        supabase
          .from('pagamentos')
          .select('cliente_id, data_pagamento')
          .in('cliente_id', idsClientesAtivos)
          .eq('inclui_seguro', true),
        supabase
          .from('pagamentos')
          .select('cliente_id, data_pagamento')
          .in('cliente_id', idsClientesAtivos)
          .eq('inclui_reativacao', true),
      ])
    : [{ data: [] }, { data: [] }]
  const segurosEmDivida = segurosPorPagar(
    clientesAtivos,
    new Date(),
    segurosPagosData ?? [],
    reativacoesData ?? []
  ).length

  const totalPagamentos = (pagamentosEstadoData ?? []).length
  const emDiaCount = totalPagamentos - mensalidadesEmDivida
  const pctEmDia = totalPagamentos > 0 ? (emDiaCount / totalPagamentos) * 100 : 100
  const pendenciasTotais = mensalidadesEmDivida + segurosEmDivida + leadsContactoAtrasado

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {ehGestao && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Link
            href={`/painel/${slug}/relatorio`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3.5 py-2 text-sm font-semibold text-foreground/80 shadow-pop transition-colors hover:border-border-strong hover:bg-brand/[.06]"
          >
            Relatório mensal
          </Link>
          <Link
            href={`/painel/${slug}/equipa`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3.5 py-2 text-sm font-semibold text-foreground/80 shadow-pop transition-colors hover:border-border-strong hover:bg-brand/[.06]"
          >
            <UsersRound className="h-4 w-4" /> Equipa
          </Link>
        </div>
      )}

      <div className="bg-tech-grid grid grid-cols-1 gap-3 rounded-2xl p-1 sm:grid-cols-3">
        <StatCard icone={UsersRound} cor={PALETA.teal} label="Clientes ativos" valor={ativos} aoVivo />
        <div className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <RadialProgress valor={pctEmDia} tamanho={52} espessura={5} cor={PALETA.ambar.tx} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Pagamentos em dia
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted">
              {emDiaCount} de {totalPagamentos}
            </p>
          </div>
        </div>
        <StatCard
          icone={AlertTriangle}
          cor={pendenciasTotais > 0 ? PALETA.vermelho : PALETA.verde}
          label="Pendências"
          valor={pendenciasTotais}
        />
      </div>

      <div className="mt-8">
        <AgendaConteudo estudio={estudio} searchParams={sp} basePath={`/painel/${slug}`} mostrarVoltar={false} />
      </div>
    </div>
  )
}
