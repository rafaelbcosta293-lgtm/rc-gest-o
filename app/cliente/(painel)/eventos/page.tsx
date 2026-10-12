import { createClient } from '@/lib/supabase/server'
import { getSessaoCliente } from '@/lib/data/sessaoCliente'
import { fmt } from '@/lib/data/presencas'
import type { Evento } from '@/lib/supabase/database.types'

export default async function EventosClientePage() {
  const { cliente } = await getSessaoCliente()
  if (!cliente) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('eventos')
    .select('*')
    .eq('publicado', true)
    .or(`estudio_id.is.null,estudio_id.eq.${cliente.estudio_id}`)
    .order('criado_em', { ascending: false })

  const eventos = (data ?? []) as Evento[]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Eventos</h1>

      {eventos.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Sem novidades por agora.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {eventos.map((ev) => (
          <div
            key={ev.id}
            className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm text-black dark:text-zinc-50">{ev.titulo}</strong>
              <span className="shrink-0 text-xs text-zinc-400">{fmt(ev.criado_em.slice(0, 10))}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
              {ev.corpo}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
