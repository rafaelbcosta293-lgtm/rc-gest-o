import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { criarEvento, atualizarEvento, apagarEvento } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { Evento } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const [estudios, { data: eventosData, error: erroEventos }] = await Promise.all([
    getEstudios(supabase),
    supabase.from('eventos').select('*').order('criado_em', { ascending: false }),
  ])

  if (erroEventos) {
    throw new Error(erroEventos.message)
  }

  const eventos = (eventosData ?? []) as Evento[]
  const nomeEstudio = (id: number | null) => estudios.find((e) => e.id === id)?.nome ?? null

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel/coordenacao" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Coordenação
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Eventos para clientes
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        O que estiver marcado como &quot;publicado&quot; aparece na app dos clientes.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        action={criarEvento}
        className="mt-6 flex flex-col gap-2 rounded-lg border border-dashed border-black/20 p-3 dark:border-white/20"
      >
        <input name="titulo" required placeholder="Título" className={inputCls} />
        <textarea name="corpo" required placeholder="Texto do evento" rows={3} className={inputCls} />
        <div className="flex flex-wrap items-center gap-3">
          <select name="estudio_id" defaultValue="" className={inputCls}>
            <option value="">Os dois estúdios</option>
            {estudios.map((e) => (
              <option key={e.id} value={e.id}>
                Só {e.nome}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" name="publicado" /> publicado
          </label>
          <SubmitButton
            pendingText="A criar…"
            className="ml-auto rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-black"
          >
            + Evento
          </SubmitButton>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {eventos.map((ev) => (
          <div
            key={ev.id}
            className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <form action={atualizarEvento} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={ev.id} />
              <input name="titulo" defaultValue={ev.titulo} required className={inputCls} />
              <textarea
                name="corpo"
                defaultValue={ev.corpo}
                required
                rows={3}
                className={inputCls}
              />
              <div className="flex flex-wrap items-center gap-3">
                <select name="estudio_id" defaultValue={ev.estudio_id ?? ''} className={inputCls}>
                  <option value="">Os dois estúdios</option>
                  {estudios.map((e) => (
                    <option key={e.id} value={e.id}>
                      Só {e.nome}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <input type="checkbox" name="publicado" defaultChecked={ev.publicado} /> publicado
                </label>
                <span className="text-xs text-zinc-400">
                  {fmt(ev.criado_em.slice(0, 10))}
                  {ev.estudio_id && ` · ${nomeEstudio(ev.estudio_id)}`}
                </span>
                <SubmitButton
                  pendingText="…"
                  className="ml-auto rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
                >
                  Guardar
                </SubmitButton>
              </div>
            </form>
            <form action={apagarEvento} className="mt-1">
              <input type="hidden" name="id" value={ev.id} />
              <SubmitButton
                pendingText="…"
                className="text-xs text-zinc-400 underline hover:text-red-600"
              >
                Eliminar
              </SubmitButton>
            </form>
          </div>
        ))}
        {eventos.length === 0 && (
          <p className="text-sm text-zinc-500">Ainda não há eventos criados.</p>
        )}
      </div>
    </div>
  )
}
