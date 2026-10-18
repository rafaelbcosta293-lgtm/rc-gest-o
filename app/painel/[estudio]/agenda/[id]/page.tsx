import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { corTipoEvento, TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
import { atualizarEvento, desmarcarEvento, reativarEvento, apagarEvento } from '../actions'
import SubmitButton from '@/components/SubmitButton'
import ClienteCombobox from '@/components/ClienteCombobox'
import type { EventoAgenda } from '@/lib/supabase/database.types'

type EventoComCliente = EventoAgenda & { cliente: { id: string; nome: string } | null }

const inputCls =
  'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

export default async function EventoAgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, id } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const { data: eventoData, error: erroEvento } = await supabase
    .from('agenda_eventos')
    .select('*, cliente:clientes(id, nome)')
    .eq('id', id)
    .eq('estudio_id', estudio.id)
    .maybeSingle()
  if (erroEvento) {
    throw new Error(erroEvento.message)
  }
  const evento = eventoData as unknown as EventoComCliente | null
  if (!evento) {
    notFound()
  }

  const [pts, { data: clientesData, error: erroClientes }] = await Promise.all([
    getEquipaDoEstudio(supabase, estudio.id),
    supabase
      .from('clientes')
      .select('id, nome')
      .eq('estudio_id', estudio.id)
      .neq('estado', 'Ex-cliente')
      .order('nome'),
  ])
  if (erroClientes) {
    throw new Error(erroClientes.message)
  }
  const clientes = (clientesData ?? []) as { id: string; nome: string }[]

  const cor = corTipoEvento(evento.tipo)
  const cancelado = evento.estado === 'Cancelado'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/agenda?vista=dia&data=${evento.data}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à agenda
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Evento</h1>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: cor.bg, color: cor.tx }}
        >
          {evento.tipo}
        </span>
        {cancelado && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
            Cancelado
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{estudio.nome}</p>

      {evento.serie_id && (
        <p className="mt-3 rounded-lg bg-brand/[.06] px-3 py-2 text-xs text-muted">
          Esta é uma ocorrência de uma série de eventos repetidos — alterar, desmarcar ou apagar
          afeta só este dia, nunca as outras ocorrências.
        </p>
      )}

      {cancelado && evento.motivo_cancelamento && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          Motivo do cancelamento: {evento.motivo_cancelamento}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      <form action={atualizarEvento} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="id" value={evento.id} />

        <div>
          <label className="text-xs font-semibold text-muted">Tipo</label>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5 rounded-full bg-border-subtle p-1">
            {TIPOS_EVENTO_AGENDA.map((t) => (
              <label key={t} className="relative">
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  defaultChecked={t === evento.tipo}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-full px-1.5 py-1.5 text-center text-[11px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                  {t}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Cliente (opcional)</label>
            <ClienteCombobox
              clientes={clientes}
              defaultValue={evento.cliente}
              placeholder="— Reunião / outro (sem cliente) —"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Instrutor (opcional)</label>
            <select name="pt_id" defaultValue={evento.pt_id ?? ''} className={inputCls}>
              <option value="">— Sem instrutor —</option>
              {pts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">
            Título (só se não houver cliente)
          </label>
          <input name="titulo" defaultValue={evento.titulo ?? ''} className={inputCls} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Data</label>
            <input type="date" name="data" defaultValue={evento.data} required className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Hora</label>
            <input
              type="time"
              name="hora_inicio"
              defaultValue={evento.hora_inicio.slice(0, 5)}
              required
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Duração</label>
            <select name="duracao_min" defaultValue={String(evento.duracao_min)} className={inputCls}>
              {[30, 40, 45, 60, 90, 120].map((min) => (
                <option key={min} value={min}>
                  {min} min
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Nota (opcional)</label>
          <textarea name="nota" rows={3} defaultValue={evento.nota ?? ''} className={inputCls} />
        </div>

        <SubmitButton
          pendingText="A guardar…"
          className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong"
        >
          Guardar alterações
        </SubmitButton>
      </form>

      <div className="mt-8 flex flex-wrap items-start gap-3 border-t border-border-subtle pt-6">
        {!cancelado ? (
          <form action={desmarcarEvento} className="flex flex-1 flex-wrap items-end gap-2">
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="id" value={evento.id} />
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted">Motivo (opcional)</label>
              <input name="motivo_cancelamento" className={`${inputCls} w-full`} />
            </div>
            <SubmitButton
              pendingText="…"
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Desmarcar
            </SubmitButton>
          </form>
        ) : (
          <form action={reativarEvento}>
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="id" value={evento.id} />
            <SubmitButton
              pendingText="…"
              className="rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold hover:bg-brand/[.06]"
            >
              Reativar
            </SubmitButton>
          </form>
        )}

        <form action={apagarEvento}>
          <input type="hidden" name="estudio_slug" value={slug} />
          <input type="hidden" name="id" value={evento.id} />
          <input type="hidden" name="data" value={evento.data} />
          <SubmitButton
            pendingText="…"
            className="rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold text-muted hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
          >
            Apagar
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
