import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSessaoCliente } from '@/lib/data/sessaoCliente'
import { fmt } from '@/lib/data/presencas'
import type { EstadoPagamento } from '@/lib/supabase/database.types'

export default async function InicioClientePage() {
  const { cliente } = await getSessaoCliente()
  if (!cliente) return null

  const supabase = await createClient()
  const { data: pagamento } = await supabase
    .from('v_estado_pagamento')
    .select('*')
    .eq('cliente_id', cliente.id)
    .maybeSingle()
  const estadoPagamento = pagamento as EstadoPagamento | null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Olá, {cliente.nome.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Bem-vindo à tua área no RC Private Fitness Studio.
        </p>
      </div>

      <Link
        href="/cliente/mensalidade"
        className="rounded-2xl border border-black/10 bg-white p-5 transition-colors hover:border-black/20 dark:border-white/10 dark:bg-zinc-950"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Mensalidade
        </span>
        {estadoPagamento ? (
          <p
            className={`mt-1.5 text-lg font-medium ${
              estadoPagamento.em_dia ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'
            }`}
          >
            {estadoPagamento.em_dia
              ? `Em dia · válido até ${fmt(estadoPagamento.valido_ate)}`
              : 'Por regularizar'}
          </p>
        ) : (
          <p className="mt-1.5 text-lg font-medium text-zinc-500">Sem pagamentos registados</p>
        )}
      </Link>

      <Link
        href="/cliente/avaliacoes"
        className="rounded-2xl border border-black/10 bg-white p-5 transition-colors hover:border-black/20 dark:border-white/10 dark:bg-zinc-950"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Avaliações físicas
        </span>
        <p className="mt-1.5 text-lg font-medium text-black dark:text-zinc-50">
          Ver o teu histórico →
        </p>
      </Link>
    </div>
  )
}
