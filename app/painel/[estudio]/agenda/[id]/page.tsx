import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { corTipoEvento } from '@/lib/data/agenda'
import { atualizarEvento, desmarcarEvento, reativarEvento, apagarEvento, pararSerie } from '../actions'
import SubmitButton from '@/components/SubmitButton'
import ApagarComConfirmacao from '@/components/ApagarComConfirmacao'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import EditarEventoForm from './EditarEventoForm'
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
    <div className="mx-auto max-w-4xl px-4 py-10">
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand/[.06] px-3 py-2">
          <p className="text-xs text-muted">
            Esta é uma ocorrência de uma série de eventos repetidos — alterar, desmarcar ou apagar
            afeta só este dia, nunca as outras ocorrências.
          </p>
          <ConfirmarAcao
            action={pararSerie}
            confirmacao="Parar esta série de vez? As próximas ocorrências já agendadas ficam desmarcadas (o histórico mantém-se); a série deixa de gerar mais."
          >
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="id" value={evento.id} />
            <input type="hidden" name="serie_id" value={evento.serie_id} />
            <SubmitButton
              pendingText="…"
              className="shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-xs font-bold hover:bg-foreground/[.08]"
            >
              Parar repetição
            </SubmitButton>
          </ConfirmarAcao>
        </div>
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

      <EditarEventoForm slug={slug} evento={evento} pts={pts} clientes={clientes} action={atualizarEvento} />

      <div className="mt-8 flex flex-wrap items-start gap-3 border-t border-border-subtle pt-6">
        {!cancelado ? (
          <form
            action={desmarcarEvento}
            className="flex flex-1 flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
          >
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="id" value={evento.id} />
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Desmarcar este evento</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted">Motivo (opcional)</label>
              <input name="motivo_cancelamento" className={`${inputCls} w-full`} />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-semibold text-muted">
                O treino foi realizado, mesmo assim? (obrigatório)
              </legend>
              <div className="flex gap-1.5">
                <label className="flex-1 cursor-pointer rounded-md border border-border-subtle px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold">
                  <input type="radio" name="conta_como_realizado" value="sim" required className="sr-only" />
                  Sim, conta como realizado
                </label>
                <label className="flex-1 cursor-pointer rounded-md border border-border-subtle px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold">
                  <input type="radio" name="conta_como_realizado" value="nao" required className="sr-only" />
                  Não
                </label>
              </div>
            </fieldset>

            <SubmitButton
              pendingText="…"
              className="self-start rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
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
              className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-brand/[.08]"
            >
              Reativar
            </SubmitButton>
          </form>
        )}

        <ApagarComConfirmacao
          action={apagarEvento}
          confirmacao="Tens a certeza que queres apagar este evento? Esta ação não pode ser desfeita."
          campos={{ estudio_slug: slug, id: evento.id, data: evento.data }}
          className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold text-muted hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
        >
          Apagar
        </ApagarComConfirmacao>
      </div>
    </div>
  )
}
