import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftRight, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { MODULOS, PALETA } from '@/lib/data/constantes'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { segurosPorPagar } from '@/lib/data/clientes'

export default async function EstudioPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params
  const supabase = await createClient()

  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }

  // Estas três só precisam do estúdio, não umas das outras — correm
  // todas ao mesmo tempo em vez de à vez.
  const [{ data: clientes }, { data: pagamentosEstadoData }, { data: leadsParadasData }] =
    await Promise.all([
      supabase.from('clientes').select('id, estado, inicio_contrato').eq('estudio_id', estudio.id),
      supabase.from('v_estado_pagamento').select('em_dia').eq('estudio_id', estudio.id),
      supabase.from('v_leads_paradas').select('id').eq('estudio_id', estudio.id),
    ])

  const { ehAdmin, ehGestao } = papeisDaSessao(sessao)
  const podeAceder = (m: (typeof MODULOS)[number]) =>
    m.pronto && (!m.restrito || (m.restrito === 'admin' ? ehAdmin : ehGestao))

  const todosClientes = clientes ?? []
  const ativos = todosClientes.filter((c) => c.estado === 'Ativo').length
  const suspensos = todosClientes.filter((c) => c.estado === 'Suspenso').length
  const inativos = todosClientes.filter((c) => c.estado === 'Ex-cliente').length

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Estúdio de {estudio.nome}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Escolhe a área onde queres trabalhar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ehGestao && (
            <Link
              href={`/painel/${slug}/equipa`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3.5 py-2 text-sm font-semibold text-foreground/80 shadow-pop transition-colors hover:border-border-strong hover:bg-brand/[.06]"
            >
              <UsersRound className="h-4 w-4" /> Equipa
            </Link>
          )}
          <Link
            href="/painel"
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3.5 py-2 text-sm font-semibold text-foreground/80 shadow-pop transition-colors hover:border-border-strong hover:bg-brand/[.06]"
          >
            <ArrowLeftRight className="h-4 w-4" /> Mudar estúdio
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {MODULOS.map((m) =>
          podeAceder(m) ? (
            <Link
              key={m.id}
              href={`/painel/${slug}/${m.id}`}
              className="group rounded-2xl border border-border-subtle bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-card-hover"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-pop transition-transform duration-300 group-hover:scale-110"
                style={{ background: PALETA[m.cor].bg, color: PALETA[m.cor].tx }}
              >
                <m.icone className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <h2 className="mt-3.5 font-bold tracking-tight text-foreground">
                {m.nome}
              </h2>
              <p className="mt-1 text-xs text-muted">{m.desc}</p>
              {m.id === 'clientes' && (
                <p className="mt-3 text-xs font-medium text-teal-700 dark:text-teal-400">
                  {ativos} ativos · {suspensos} suspensos · {inativos} inativos
                </p>
              )}
              {m.id === 'pagamentos' && (
                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {segurosEmDivida} {segurosEmDivida === 1 ? 'seguro em dívida' : 'seguros em dívida'} ·{' '}
                  {mensalidadesEmDivida} {mensalidadesEmDivida === 1 ? 'mensalidade em dívida' : 'mensalidades em dívida'}
                </p>
              )}
              {m.id === 'leads' && (
                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {leadsContactoAtrasado} {leadsContactoAtrasado === 1 ? 'lead' : 'leads'} com contacto em
                  atraso
                </p>
              )}
            </Link>
          ) : (
            <div
              key={m.id}
              className="rounded-xl border border-dashed border-border-subtle bg-surface/50 p-5 opacity-60"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-border-subtle text-muted">
                <m.icone className="h-5 w-5" strokeWidth={2} />
              </span>
              <h2 className="mt-3 font-semibold text-foreground">
                {m.nome}
              </h2>
              <p className="mt-1 text-xs text-muted">{m.desc}</p>
              <p className="mt-3 text-xs font-medium text-muted">
                {!m.pronto
                  ? 'Brevemente'
                  : m.restrito === 'admin'
                    ? 'Só para administradores'
                    : 'Só para gestão'}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
