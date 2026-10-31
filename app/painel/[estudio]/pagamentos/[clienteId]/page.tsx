import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { criarPagamento, apagarPagamento, registarPagamentoSeguro } from '../actions'
import PagamentoForm from '../PagamentoForm'
import SubmitButton from '@/components/SubmitButton'
import type { Pagamento, Plano } from '@/lib/supabase/database.types'

type PagamentoComExtras = Pagamento & {
  plano: { nome: string } | null
  registado: { nome: string } | null
}

export default async function PagamentosClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const { error } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const [
    estudio,
    { data: cliente },
    { data: pagamentosData, error: erroPagamentos },
    { data: planosData },
  ] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('clientes').select('id, nome, estudio_id').eq('id', clienteId).maybeSingle(),
    supabase
      .from('pagamentos')
      .select('*, plano:planos(nome), registado:perfis!registado_por(nome)')
      .eq('cliente_id', clienteId)
      .order('data_pagamento', { ascending: false }),
    supabase.from('planos').select('*').eq('ativo', true).order('valor'),
  ])

  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  if (erroPagamentos) {
    throw new Error(erroPagamentos.message)
  }

  const pagamentos = (pagamentosData ?? []) as unknown as PagamentoComExtras[]
  const planos = (planosData ?? []) as Plano[]
  const validoAte = pagamentos.reduce<string | null>(
    (max, p) => (!max || p.valido_ate > max ? p.valido_ate : max),
    null
  )
  const emDia = validoAte !== null && validoAte >= hoje

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/pagamentos`}
        className="text-sm text-muted underline"
      >
        ← Pagamentos
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        {cliente.nome}
      </h1>
      <p
        className={`mt-1 text-sm font-medium ${emDia ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'}`}
      >
        {validoAte
          ? emDia
            ? `Em dia · válido até ${fmt(validoAte)}`
            : `Atrasado desde ${fmt(validoAte)}`
          : 'Sem pagamentos registados'}
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Registar pagamento
      </h2>
      <PagamentoForm
        estudioSlug={slug}
        clienteId={clienteId}
        planos={planos}
        action={criarPagamento}
      />

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Registar só o seguro
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Sem mexer na mensalidade — só marca o seguro deste ciclo como pago.
      </p>
      <form action={registarPagamentoSeguro} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="cliente_id" value={clienteId} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Valor (€)</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            required
            className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Data do pagamento
          </label>
          <input
            name="data_pagamento"
            type="date"
            defaultValue={hoje}
            className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]"
        >
          Registar seguro
        </SubmitButton>
      </form>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico ({pagamentos.length})
      </h2>
      {pagamentos.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
          Ainda não há pagamentos registados.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {pagamentos.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface p-3 text-sm"
          >
            <span className="font-medium text-foreground">{p.valor}€</span>
            <span className="text-xs text-zinc-500">{p.plano?.nome ?? 'sem plano'}</span>
            <span className="text-xs text-zinc-500">{p.metodo}</span>
            <span className="text-xs text-zinc-500">
              pago {fmt(p.data_pagamento)} · válido até {fmt(p.valido_ate)}
            </span>
            {(p.inclui_inscricao || p.inclui_seguro || p.inclui_reativacao) && (
              <span className="text-xs text-zinc-500">
                +{[
                  p.inclui_inscricao && 'inscrição',
                  p.inclui_seguro && 'seguro',
                  p.inclui_reativacao && 'reativação',
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            )}
            {p.registado && (
              <span className="text-xs text-zinc-400">· {p.registado.nome}</span>
            )}
            {p.nota && (
              <span className="w-full text-xs text-muted">{p.nota}</span>
            )}
            <form action={apagarPagamento} className="ml-auto">
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="cliente_id" value={clienteId} />
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton
                pendingText="…"
                aria-label="Apagar"
                className="text-lg text-zinc-400 hover:text-red-600"
              >
                ×
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
