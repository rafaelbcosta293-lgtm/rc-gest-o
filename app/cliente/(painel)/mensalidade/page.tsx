import { createClient } from '@/lib/supabase/server'
import { getSessaoCliente } from '@/lib/data/sessaoCliente'
import { fmt } from '@/lib/data/presencas'
import type { EstadoPagamento, Pagamento, Plano } from '@/lib/supabase/database.types'

type PagamentoComPlano = Pagamento & { plano: Pick<Plano, 'nome'> | null }

export default async function MensalidadeClientePage() {
  const { cliente } = await getSessaoCliente()
  if (!cliente) return null

  const supabase = await createClient()
  const [{ data: pagamento }, { data: historicoData }] = await Promise.all([
    supabase.from('v_estado_pagamento').select('*').eq('cliente_id', cliente.id).maybeSingle(),
    supabase
      .from('pagamentos')
      .select('*, plano:planos(nome)')
      .eq('cliente_id', cliente.id)
      .order('data_pagamento', { ascending: false }),
  ])

  const estadoPagamento = pagamento as EstadoPagamento | null
  const historico = (historicoData ?? []) as unknown as PagamentoComPlano[]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Mensalidade</h1>

      <div
        className={`rounded-2xl border p-5 ${
          estadoPagamento?.em_dia
            ? 'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950'
            : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
        }`}
      >
        {estadoPagamento ? (
          <>
            <p
              className={`text-lg font-semibold ${
                estadoPagamento.em_dia ? 'text-teal-700 dark:text-teal-300' : 'text-red-700 dark:text-red-300'
              }`}
            >
              {estadoPagamento.em_dia ? 'Em dia' : 'Por regularizar'}
            </p>
            {estadoPagamento.valido_ate && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {estadoPagamento.em_dia ? 'Válido até' : 'Venceu em'} {fmt(estadoPagamento.valido_ate)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Sem pagamentos registados.</p>
        )}
      </div>

      <h2 className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico
      </h2>
      {historico.length === 0 && (
        <p className="text-sm text-zinc-500">Ainda não há pagamentos registados.</p>
      )}
      <div className="flex flex-col gap-2">
        {historico.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-black dark:text-zinc-50">{p.valor}€</span>
              <span className="text-xs text-zinc-500">{fmt(p.data_pagamento)}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {p.plano?.nome ?? 'sem plano'} · válido até {fmt(p.valido_ate)}
            </p>
            {(p.inclui_inscricao || p.inclui_seguro || p.inclui_reativacao) && (
              <p className="mt-1 text-xs text-zinc-500">
                +{[
                  p.inclui_inscricao && 'inscrição',
                  p.inclui_seguro && 'seguro',
                  p.inclui_reativacao && 'reativação',
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
