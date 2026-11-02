import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UsersRound, AlertTriangle, BellRing, Cake } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { PALETA } from '@/lib/data/constantes'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { segurosPorPagar } from '@/lib/data/clientes'
import { proximoAniversario, idadeEm } from '@/lib/data/aniversarios'
import StatCard from '@/components/StatCard'
import RadialProgress from '@/components/RadialProgress'
import AgendaConteudo from './agenda/AgendaConteudo'
import type { AlertaRegistado, SeveridadeAlerta } from '@/lib/supabase/database.types'

const ORDEM_SEVERIDADE: Record<SeveridadeAlerta, number> = { Crítico: 0, Atenção: 1, Info: 2 }
const COR_SEVERIDADE: Record<SeveridadeAlerta, { bg: string; tx: string }> = {
  Crítico: PALETA.vermelho,
  Atenção: PALETA.ambar,
  Info: PALETA.azul,
}

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

  // Estas quatro só precisam do estúdio, não umas das outras — correm
  // todas ao mesmo tempo em vez de à vez.
  const [{ data: clientes }, { data: pagamentosEstadoData }, { data: leadsParadasData }, { data: alertasData }] =
    await Promise.all([
      supabase.from('clientes').select('id, nome, nascimento, estado, inicio_contrato').eq('estudio_id', estudio.id),
      supabase.from('v_estado_pagamento').select('em_dia').eq('estudio_id', estudio.id),
      supabase.from('v_leads_paradas').select('id').eq('estudio_id', estudio.id),
      supabase.from('alerts').select('*').eq('estudio_id', estudio.id).neq('estado', 'Resolvido'),
    ])

  const { ehGestao } = papeisDaSessao(sessao)

  const todosClientes = clientes ?? []
  const ativos = todosClientes.filter((c) => c.estado === 'Ativo').length

  const mensalidadesEmDivida = (pagamentosEstadoData ?? []).filter((p) => !p.em_dia).length
  const leadsContactoAtrasado = (leadsParadasData ?? []).length

  // Mesmo critério de visibilidade da página de Alertas: quem não gere
  // o estúdio só vê os alertas destinados ao seu papel.
  const todosAlertas = (alertasData ?? []) as AlertaRegistado[]
  const alertasVisiveis = ehGestao
    ? todosAlertas
    : todosAlertas.filter((a) => a.papel_destinatario && a.papel_destinatario === sessao.perfil?.papel)
  const alertasResumo = [...alertasVisiveis]
    .sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade])
    .slice(0, 4)

  const hoje = new Date()
  const aniversariantesHoje = todosClientes
    .filter((c) => c.estado === 'Ativo' && c.nascimento && proximoAniversario(c.nascimento, hoje).dias === 0)
    .map((c) => ({ id: c.id, nome: c.nome, idade: idadeEm(c.nascimento!, hoje) }))

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
    <div className="px-4 py-4 sm:px-6">
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
        <Link
          href={`/painel/${slug}/pagamentos`}
          className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-brand/[.04]"
        >
          <RadialProgress valor={pctEmDia} tamanho={52} espessura={5} cor={PALETA.ambar.tx} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Pagamentos em dia
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted">
              {emDiaCount} de {totalPagamentos}
            </p>
          </div>
        </Link>

        {/* Cada linha leva à página onde esse tipo de pendência se
            resolve — mensalidades e seguros em Pagamentos, leads em
            Leads — em vez de só mostrar um número único. */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <AlertTriangle
              className="h-3.5 w-3.5"
              style={{ color: pendenciasTotais > 0 ? PALETA.vermelho.tx : PALETA.verde.tx }}
            />
            Pendências
          </p>
          {pendenciasTotais === 0 ? (
            <p className="mt-2 text-xs text-muted">Sem pendências.</p>
          ) : (
            <div className="mt-1 flex flex-col">
              {mensalidadesEmDivida > 0 && (
                <Link
                  href={`/painel/${slug}/pagamentos`}
                  className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-xs text-foreground transition-colors hover:bg-brand/[.07]"
                >
                  Mensalidades em dívida
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">{mensalidadesEmDivida}</span>
                </Link>
              )}
              {segurosEmDivida > 0 && (
                <Link
                  href={`/painel/${slug}/pagamentos`}
                  className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-xs text-foreground transition-colors hover:bg-brand/[.07]"
                >
                  Seguros em dívida
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">{segurosEmDivida}</span>
                </Link>
              )}
              {leadsContactoAtrasado > 0 && (
                <Link
                  href={`/painel/${slug}/leads`}
                  className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-xs text-foreground transition-colors hover:bg-brand/[.07]"
                >
                  Leads por contactar
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">{leadsContactoAtrasado}</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resumo do dia: alertas ativos e quem faz anos hoje — para ver
          logo de manhã sem ter de abrir cada módulo à parte. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href={`/painel/${slug}/alertas`}
          className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-brand/[.04]"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <BellRing
              className="h-3.5 w-3.5"
              style={{ color: alertasVisiveis.length > 0 ? PALETA.vermelho.tx : PALETA.verde.tx }}
            />
            Alertas ({alertasVisiveis.length})
          </p>
          {alertasResumo.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Sem alertas ativos.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1">
              {alertasResumo.map((a) => (
                <li key={a.id} className="flex items-center gap-1.5 text-xs text-foreground">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: COR_SEVERIDADE[a.severidade].tx }}
                  />
                  <span className="truncate">{a.titulo}</span>
                </li>
              ))}
              {alertasVisiveis.length > alertasResumo.length && (
                <li className="text-xs text-muted">+ {alertasVisiveis.length - alertasResumo.length} mais</li>
              )}
            </ul>
          )}
        </Link>

        <Link
          href={`/painel/${slug}/clientes/aniversarios`}
          className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-brand/[.04]"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Cake className="h-3.5 w-3.5" style={{ color: PALETA.roxo.tx }} />
            Aniversários hoje
          </p>
          {aniversariantesHoje.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Ninguém faz anos hoje.</p>
          ) : (
            <p className="mt-1.5 text-xs text-foreground">
              {aniversariantesHoje.map((c) => `${c.nome} (${c.idade})`).join(', ')}
            </p>
          )}
        </Link>
      </div>

      <div className="mt-8">
        <AgendaConteudo estudio={estudio} searchParams={sp} basePath={`/painel/${slug}`} mostrarVoltar={false} />
      </div>
    </div>
  )
}
