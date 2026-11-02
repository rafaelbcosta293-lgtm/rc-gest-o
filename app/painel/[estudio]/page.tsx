import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UsersRound, AlertTriangle, BellRing, Cake, CreditCard, Megaphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { PALETA } from '@/lib/data/constantes'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { segurosPorPagar } from '@/lib/data/clientes'
import { proximoAniversario, idadeEm } from '@/lib/data/aniversarios'
import AgendaConteudo from './agenda/AgendaConteudo'
import type { AlertaRegistado } from '@/lib/supabase/database.types'

// Cartão compacto e clicável para a linha de resumo do início do
// estúdio — número grande para leitura rápida, cada um leva à pasta
// onde se vê o pormenor (não há breakdown aqui propositadamente).
function CartaoResumo({
  href,
  icone: Icone,
  cor,
  label,
  valor,
  extra,
  aviso = false,
}: {
  href: string
  icone: LucideIcon
  cor: { bg: string; tx: string }
  label: string
  valor: string | number
  extra?: string
  aviso?: boolean
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-col gap-2 rounded-2xl border bg-surface p-3.5 shadow-card transition-colors hover:border-border-strong hover:bg-brand/[.04] ${
        aviso ? 'border-red-200 dark:border-red-900' : 'border-border-subtle'
      }`}
    >
      {aviso && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500" aria-hidden />
      )}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: cor.bg, color: cor.tx }}
      >
        <Icone className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div>
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-1 font-mono text-xl font-bold leading-none tabular-nums text-foreground">{valor}</p>
        {extra && <p className="mt-1 truncate text-[11px] text-muted">{extra}</p>}
      </div>
    </Link>
  )
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

  // Estas cinco só precisam do estúdio, não umas das outras — correm
  // todas ao mesmo tempo em vez de à vez.
  const [
    { data: clientes },
    { data: pagamentosEstadoData },
    { data: leadsParadasData },
    { data: alertasData },
    { count: leadsNovasCount },
  ] = await Promise.all([
    supabase.from('clientes').select('id, nome, nascimento, estado, inicio_contrato').eq('estudio_id', estudio.id),
    supabase.from('v_estado_pagamento').select('em_dia').eq('estudio_id', estudio.id),
    supabase.from('v_leads_paradas').select('id').eq('estudio_id', estudio.id),
    supabase.from('alerts').select('*').eq('estudio_id', estudio.id).neq('estado', 'Resolvido'),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('estudio_id', estudio.id)
      .eq('estado', 'Nova'),
  ])
  const leadsNovas = leadsNovasCount ?? 0

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

      {/* Resumo do dia inteiro numa só linha (computador) — cada caixa é
          só o essencial para uma leitura rápida; para mais pormenor
          abre-se a pasta correspondente. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CartaoResumo
          href={`/painel/${slug}/clientes`}
          icone={UsersRound}
          cor={PALETA.teal}
          label="Clientes ativos"
          valor={ativos}
        />
        <CartaoResumo
          href={`/painel/${slug}/pagamentos`}
          icone={CreditCard}
          cor={PALETA.ambar}
          label="Pagamentos em dia"
          valor={emDiaCount}
          extra={`de ${totalPagamentos}`}
        />
        <CartaoResumo
          href={`/painel/${slug}/pagamentos`}
          icone={AlertTriangle}
          cor={pendenciasTotais > 0 ? PALETA.vermelho : PALETA.verde}
          label="Pendências"
          valor={pendenciasTotais}
          aviso={pendenciasTotais > 0}
        />
        <CartaoResumo
          href={`/painel/${slug}/alertas`}
          icone={BellRing}
          cor={alertasVisiveis.length > 0 ? PALETA.vermelho : PALETA.verde}
          label="Alertas"
          valor={alertasVisiveis.length}
          aviso={alertasVisiveis.length > 0}
        />
        <CartaoResumo
          href={`/painel/${slug}/clientes/aniversarios`}
          icone={Cake}
          cor={PALETA.roxo}
          label="Aniversários hoje"
          valor={aniversariantesHoje.length}
          extra={
            aniversariantesHoje.length > 0
              ? aniversariantesHoje.map((c) => `${c.nome} (${c.idade})`).join(', ')
              : undefined
          }
        />
        <CartaoResumo
          href={`/painel/${slug}/leads`}
          icone={Megaphone}
          cor={PALETA.laranja}
          label="Leads novas"
          valor={leadsNovas}
          aviso={leadsNovas > 0}
        />
      </div>

      <div className="mt-8">
        <AgendaConteudo estudio={estudio} searchParams={sp} basePath={`/painel/${slug}`} mostrarVoltar={false} />
      </div>
    </div>
  )
}
