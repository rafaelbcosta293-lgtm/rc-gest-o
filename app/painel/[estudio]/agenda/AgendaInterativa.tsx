'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Trash2, Ban, RotateCcw } from 'lucide-react'
import ClienteCombobox, { type ClienteOpcao } from '@/components/ClienteCombobox'
import { corTipoEvento, TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
import { chaveSlot, BLOCOS_HORARIO } from '@/lib/data/horarios'
import { fmt, DIAS_SEMANA } from '@/lib/data/presencas'
import {
  criarEventoRapido,
  atualizarEventoRapido,
  moverEventoRapido,
  desmarcarEventoRapido,
  reativarEventoRapido,
  apagarEventoRapido,
} from './actions'
import type { EventoAgenda, TipoEventoAgenda as TipoEvento } from '@/lib/supabase/database.types'

export type EventoComNomes = EventoAgenda & {
  cliente: { id: string; nome: string } | null
  pt: { id: string; nome: string } | null
}

type PtOpcao = { id: string; nome: string }

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

function rotuloEvento(e: EventoComNomes) {
  return e.cliente?.nome ?? e.titulo ?? e.tipo
}

function horaFim(horaInicio: string, duracaoMin: number) {
  const [h, m] = horaInicio.slice(0, 5).split(':').map(Number)
  const totalMin = h * 60 + m + duracaoMin
  const hf = Math.floor(totalMin / 60) % 24
  const mf = totalMin % 60
  return `${String(hf).padStart(2, '0')}:${String(mf).padStart(2, '0')}`
}

// A grelha de semana só tem blocos de 30 em 30 min — um evento criado a
// outra hora qualquer aparece arredondado para baixo, só para efeitos de
// onde é mostrado na grelha (a hora real gravada não muda).
function blocoArredondado(horaInicio: string) {
  const [h, m] = horaInicio.slice(0, 5).split(':').map(Number)
  return { hora: h, minuto: m < 30 ? 0 : 30 }
}

type EstadoModal =
  | { aberto: false }
  | { aberto: true; modo: 'criar'; data: string; horaInicio: string }
  | { aberto: true; modo: 'editar'; evento: EventoComNomes }

export default function AgendaInterativa({
  vista,
  slug,
  estudioId,
  dias,
  eventos,
  clientes,
  pts,
}: {
  vista: 'dia' | 'semana'
  slug: string
  estudioId: number
  dias: string[]
  eventos: EventoComNomes[]
  clientes: ClienteOpcao[]
  pts: PtOpcao[]
}) {
  const router = useRouter()
  const [modal, setModal] = useState<EstadoModal>({ aberto: false })
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [aPendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setModal({ aberto: false })
    setErro(null)
  }

  function aposSucesso() {
    fechar()
    router.refresh()
  }

  function mover(id: string, novaData: string, novaHoraInicio: string) {
    iniciarTransicao(async () => {
      const resultado = await moverEventoRapido({
        estudioSlug: slug,
        id,
        data: novaData,
        horaInicio: novaHoraInicio,
      })
      if ('error' in resultado) setErro(resultado.error)
      else router.refresh()
    })
  }

  function aoSubmeter(formData: FormData) {
    const campos = {
      estudioSlug: slug,
      tipo: formData.get('tipo') as TipoEvento,
      clienteId: (formData.get('cliente_id') as string) || null,
      ptId: (formData.get('pt_id') as string) || null,
      titulo: (formData.get('titulo') as string)?.trim() || null,
      data: formData.get('data') as string,
      horaInicio: formData.get('hora_inicio') as string,
      duracaoMin: Number(formData.get('duracao_min')) || 40,
      nota: (formData.get('nota') as string)?.trim() || null,
    }

    iniciarTransicao(async () => {
      const resultado =
        modal.aberto && modal.modo === 'editar'
          ? await atualizarEventoRapido({ ...campos, id: modal.evento.id })
          : await criarEventoRapido({ ...campos, estudioId })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function desmarcar() {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const id = modal.evento.id
    iniciarTransicao(async () => {
      const resultado = await desmarcarEventoRapido({ estudioSlug: slug, id, motivo: null })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function reativar() {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const id = modal.evento.id
    iniciarTransicao(async () => {
      const resultado = await reativarEventoRapido({ estudioSlug: slug, id })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function apagar() {
    if (!(modal.aberto && modal.modo === 'editar')) return
    if (!window.confirm('Apagar este evento? Não é possível desfazer.')) return
    const id = modal.evento.id
    iniciarTransicao(async () => {
      const resultado = await apagarEventoRapido({ estudioSlug: slug, id })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  const slots: Record<string, EventoComNomes[]> = {}
  for (const e of eventos) {
    const { hora, minuto } = blocoArredondado(e.hora_inicio)
    const chave = chaveSlot(e.data, hora, minuto)
    const lista = slots[chave] ?? []
    lista.push(e)
    slots[chave] = lista
  }

  return (
    <>
      {vista === 'dia' ? (
        <ListaDiaInterativa
          eventos={eventos}
          onAbrirEvento={(e) => setModal({ aberto: true, modo: 'editar', evento: e })}
          onNovoEvento={() => setModal({ aberto: true, modo: 'criar', data: dias[0], horaInicio: '09:00' })}
        />
      ) : (
        <GrelhaSemanaInterativa
          dias={dias}
          slots={slots}
          dragOver={dragOver}
          onDragOverChave={setDragOver}
          onDrop={(id, dia, hora, minuto) => {
            setDragOver(null)
            mover(id, dia, `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`)
          }}
          onClickCelulaVazia={(dia, hora, minuto) =>
            setModal({
              aberto: true,
              modo: 'criar',
              data: dia,
              horaInicio: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
            })
          }
          onAbrirEvento={(e) => setModal({ aberto: true, modo: 'editar', evento: e })}
        />
      )}

      {modal.aberto && (
        <EventoModalOverlay
          modal={modal}
          clientes={clientes}
          pts={pts}
          erro={erro}
          aPendente={aPendente}
          slug={slug}
          onFechar={fechar}
          onSubmeter={aoSubmeter}
          onDesmarcar={desmarcar}
          onReativar={reativar}
          onApagar={apagar}
        />
      )}
    </>
  )
}

function ListaDiaInterativa({
  eventos,
  onAbrirEvento,
  onNovoEvento,
}: {
  eventos: EventoComNomes[]
  onAbrirEvento: (evento: EventoComNomes) => void
  onNovoEvento: () => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={onNovoEvento}
        className="self-start rounded-full border border-dashed border-border-subtle px-3 py-1.5 text-xs font-medium text-muted hover:border-brand hover:text-brand"
      >
        + Clicar para adicionar
      </button>
      {eventos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          Sem eventos neste dia.
        </div>
      )}
      {eventos.map((e) => {
        const cor = corTipoEvento(e.tipo)
        const cancelado = e.estado === 'Cancelado'
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onAbrirEvento(e)}
            className={`flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3 text-left shadow-card transition-colors hover:bg-brand/[.04] ${
              cancelado ? 'opacity-50' : ''
            }`}
          >
            <div className="w-14 shrink-0 text-xs font-medium text-muted">
              {e.hora_inicio.slice(0, 5)}
              <br />
              {horaFim(e.hora_inicio, e.duracao_min)}
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: cor.bg, color: cor.tx }}
            >
              {e.tipo}
            </span>
            <span
              className={`flex-1 truncate text-sm font-semibold text-foreground ${
                cancelado ? 'line-through' : ''
              }`}
            >
              {rotuloEvento(e)}
            </span>
            {e.pt && <span className="shrink-0 text-xs text-muted">{e.pt.nome}</span>}
            {cancelado && <span className="shrink-0 text-xs font-medium text-red-600">Cancelado</span>}
          </button>
        )
      })}
    </div>
  )
}

function GrelhaSemanaInterativa({
  dias,
  slots,
  dragOver,
  onDragOverChave,
  onDrop,
  onClickCelulaVazia,
  onAbrirEvento,
}: {
  dias: string[]
  slots: Record<string, EventoComNomes[]>
  dragOver: string | null
  onDragOverChave: (chave: string | null) => void
  onDrop: (id: string, dia: string, hora: number, minuto: number) => void
  onClickCelulaVazia: (dia: string, hora: number, minuto: number) => void
  onAbrirEvento: (evento: EventoComNomes) => void
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <p className="mb-2 text-xs text-muted">
        Clica num espaço vazio para criar, clica num evento para editar, arrasta um evento para o
        mover.
      </p>
      <div
        className="grid min-w-[760px] gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle text-xs"
        style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
      >
        <div className="bg-brand/[.05] p-1" />
        {dias.map((d, i) => (
          <div key={d} className="bg-brand/[.05] p-1 text-center font-semibold text-foreground">
            {DIAS_SEMANA[i]}
            <br />
            <span className="font-normal text-muted">{fmt(d)}</span>
          </div>
        ))}
        {BLOCOS_HORARIO.map((bloco) => (
          <Fragment key={`${bloco.hora}-${bloco.minuto}`}>
            <div className="flex items-center bg-surface p-1 text-muted">{bloco.label}</div>
            {dias.map((dia) => {
              const chave = chaveSlot(dia, bloco.hora, bloco.minuto)
              const atual = slots[chave] ?? []
              const emDrag = dragOver === chave
              return (
                <div
                  key={dia}
                  onDragOver={(e) => {
                    e.preventDefault()
                    onDragOverChave(chave)
                  }}
                  onDragLeave={() => onDragOverChave(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/plain')
                    if (id) onDrop(id, dia, bloco.hora, bloco.minuto)
                  }}
                  onClick={() => {
                    if (atual.length === 0) onClickCelulaVazia(dia, bloco.hora, bloco.minuto)
                  }}
                  className={`flex min-h-[1.5rem] cursor-pointer flex-col justify-center gap-0.5 bg-surface p-0.5 text-[10px] leading-tight transition-colors hover:bg-brand/[.05] ${
                    emDrag ? 'bg-brand/[.14]' : ''
                  }`}
                >
                  {atual.map((e) => {
                    const cor = corTipoEvento(e.tipo)
                    return (
                      <button
                        key={e.id}
                        type="button"
                        draggable
                        onDragStart={(ev) => {
                          ev.dataTransfer.setData('text/plain', e.id)
                          ev.dataTransfer.effectAllowed = 'move'
                        }}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          onAbrirEvento(e)
                        }}
                        className={`truncate rounded px-1 py-0.5 text-left font-medium ${
                          e.estado === 'Cancelado' ? 'opacity-50 line-through' : ''
                        }`}
                        style={{ background: cor.bg, color: cor.tx }}
                      >
                        {rotuloEvento(e)}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function EventoModalOverlay({
  modal,
  clientes,
  pts,
  erro,
  aPendente,
  slug,
  onFechar,
  onSubmeter,
  onDesmarcar,
  onReativar,
  onApagar,
}: {
  modal: Extract<EstadoModal, { aberto: true }>
  clientes: ClienteOpcao[]
  pts: PtOpcao[]
  erro: string | null
  aPendente: boolean
  slug: string
  onFechar: () => void
  onSubmeter: (formData: FormData) => void
  onDesmarcar: () => void
  onReativar: () => void
  onApagar: () => void
}) {
  const editar = modal.modo === 'editar'
  const evento = modal.modo === 'editar' ? modal.evento : null
  const dataDefault = modal.modo === 'editar' ? modal.evento.data : modal.data
  const horaDefault = modal.modo === 'editar' ? modal.evento.hora_inicio.slice(0, 5) : modal.horaInicio

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{editar ? 'Editar evento' : 'Novo evento'}</h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full p-1 text-muted hover:bg-brand/[.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {evento?.serie_id && (
          <p className="mt-2 rounded-lg bg-brand/[.06] px-3 py-2 text-xs text-muted">
            Parte de uma série repetida — isto só afeta esta ocorrência.
          </p>
        )}

        {erro && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {erro}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmeter(new FormData(e.currentTarget))
          }}
          className="mt-3 flex flex-col gap-3"
        >
          <div className="grid grid-cols-4 gap-1 rounded-full bg-border-subtle p-1">
            {TIPOS_EVENTO_AGENDA.map((t) => (
              <label key={t} className="relative">
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  defaultChecked={evento ? t === evento.tipo : t === 'Treino'}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-full px-1 py-1 text-center text-[10px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                  {t}
                </span>
              </label>
            ))}
          </div>

          <ClienteCombobox clientes={clientes} defaultValue={evento?.cliente ?? null} />

          <select name="pt_id" defaultValue={evento?.pt_id ?? ''} className={inputCls}>
            <option value="">— Sem instrutor —</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <input
            name="titulo"
            defaultValue={evento?.titulo ?? ''}
            placeholder="Título (sem cliente)"
            className={inputCls}
          />

          <div className="grid grid-cols-3 gap-2">
            <input type="date" name="data" defaultValue={dataDefault} required className={inputCls} />
            <input type="time" name="hora_inicio" defaultValue={horaDefault} required className={inputCls} />
            <select name="duracao_min" defaultValue={String(evento?.duracao_min ?? 40)} className={inputCls}>
              {[30, 40, 45, 60, 90, 120].map((min) => (
                <option key={min} value={min}>
                  {min} min
                </option>
              ))}
            </select>
          </div>

          <textarea
            name="nota"
            rows={2}
            defaultValue={evento?.nota ?? ''}
            placeholder="Nota (opcional)"
            className={inputCls}
          />

          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="submit"
              disabled={aPendente}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong disabled:opacity-60"
            >
              {aPendente ? 'A guardar…' : 'Guardar'}
            </button>
            <div className="flex items-center gap-1.5">
              {editar && evento?.estado !== 'Cancelado' && (
                <button
                  type="button"
                  onClick={onDesmarcar}
                  disabled={aPendente}
                  title="Desmarcar"
                  className="rounded-full p-2 text-muted hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
              {editar && evento?.estado === 'Cancelado' && (
                <button
                  type="button"
                  onClick={onReativar}
                  disabled={aPendente}
                  title="Reativar"
                  className="rounded-full p-2 text-muted hover:bg-brand/[.06] hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              {editar && (
                <button
                  type="button"
                  onClick={onApagar}
                  disabled={aPendente}
                  title="Apagar"
                  className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        {editar && evento && (
          <Link
            href={`/painel/${slug}/agenda/${evento.id}`}
            className="mt-3 block text-center text-xs text-muted underline hover:text-foreground"
          >
            Ver ficha completa
          </Link>
        )}
      </div>
    </div>
  )
}
