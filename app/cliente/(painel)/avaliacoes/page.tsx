import { createClient } from '@/lib/supabase/server'
import { getSessaoCliente } from '@/lib/data/sessaoCliente'
import { fmt } from '@/lib/data/presencas'
import type { Avaliacao } from '@/lib/supabase/database.types'

function diferenca(atual: number | null, anterior: number | null) {
  if (atual === null || anterior === null) return null
  return Math.round((atual - anterior) * 10) / 10
}

function CartaoEstatistica({
  valor,
  label,
  delta,
}: {
  valor: number | null
  label: string
  delta?: number | null
}) {
  return (
    <div className="rounded-xl bg-white p-3 dark:bg-zinc-950">
      <strong className="block text-lg text-black dark:text-zinc-50">{valor ?? '—'}</strong>
      <span className="text-xs text-zinc-500">
        {label}
        {delta != null && delta !== 0 && (
          <> · {delta > 0 ? '+' : ''}{delta}</>
        )}
      </span>
    </div>
  )
}

export default async function AvaliacoesClientePage() {
  const { cliente } = await getSessaoCliente()
  if (!cliente) return null

  const supabase = await createClient()
  const { data: avaliacoesData } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('cliente_id', cliente.id)
    .order('data', { ascending: false })

  const lista = (avaliacoesData ?? []) as Avaliacao[]
  const [atual, anterior] = lista

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Avaliações físicas</h1>

      {lista.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não tens avaliações registadas.
        </p>
      )}

      {atual && (
        <>
          <p className="text-xs text-zinc-500">Última avaliação · {fmt(atual.data)}</p>
          <div className="grid grid-cols-2 gap-2">
            <CartaoEstatistica
              valor={atual.peso_kg}
              label="peso (kg)"
              delta={anterior ? diferenca(atual.peso_kg, anterior.peso_kg) : null}
            />
            <CartaoEstatistica
              valor={atual.massa_gorda_pct}
              label="massa gorda (%)"
              delta={anterior ? diferenca(atual.massa_gorda_pct, anterior.massa_gorda_pct) : null}
            />
            <CartaoEstatistica valor={atual.massa_muscular_kg} label="massa muscular (kg)" />
            <CartaoEstatistica valor={atual.imc} label="IMC" />
          </div>

          {atual.proxima_reavaliacao && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
              <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Próxima reavaliação
              </div>
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
                {fmt(atual.proxima_reavaliacao)}
              </p>
            </div>
          )}
        </>
      )}

      {lista.length > 1 && (
        <>
          <h2 className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Histórico
          </h2>
          <div className="flex flex-col gap-2">
            {lista.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950"
              >
                <span className="w-20 shrink-0 text-xs text-zinc-500">{fmt(a.data)}</span>
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {a.peso_kg ? `${a.peso_kg} kg` : '—'}
                  {a.massa_gorda_pct ? ` · ${a.massa_gorda_pct}% gordura` : ''}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
