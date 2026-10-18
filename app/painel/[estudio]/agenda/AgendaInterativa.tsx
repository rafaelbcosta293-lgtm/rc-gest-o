'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Trash2, Ban, RotateCcw } from 'lucide-react'
import ClienteCombobox, { type ClienteOpcao } from '@/components/ClienteCombobox'
import { corTipoEvento, TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
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

const DURACOES_COMUNS = [30, 40, 45, 60, 90, 120]

function rotuloEvento(e: EventoComNomes) {
  return e.cliente?.nome ?? e.titulo ?? e.tipo
}

function minutosParaHora(minutos: number) {
  const h = Math.floor(minutos / 60) % 24
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function minutosDoDia(horaInicio: string) {
  const [h, m] = horaInicio.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function horaFim(horaInicio: string, duracaoMin: number) {
  return minutosParaHora(minutosDoDia(horaInicio) + duracaoMin)
}

type EstadoModal =
  | { aberto: false }
  | { aberto: true; modo: 'criar'; data: string; horaInicio: string }
  | { aberto: true; modo: 'editar'; evento: EventoComNomes }

export default function AgendaInterativa({
  slug,
  estudioId,
  dias,
  eventos,
  clientes,
  pts,
}: {
  slug: string
  estudioId: number
  dias: string[]
  eventos: EventoComNomes[]
  clientes: ClienteOpcao[]
  pts: PtOpcao[]
}) {
  const router = useRouter()
  const [modal, setModal] = useState<EstadoModal>({ aberto: false })
  const [dragOverDia, setDragOverDia] = useState<string | null>(null)
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

  const porDia: Record<string, EventoComNomes[]> = {}
  for (const e of eventos) {
    const lista = porDia[e.data] ?? []
    lista.push(e)
    porDia[e.data] = lista
  }

  return (
    <>
      <GrelhaInterativa
        dias={dias}
        porDia={porDia}
        dragOverDia={dragOverDia}
        onDragOverDia={setDragOverDia}
        onDrop={(id, dia, horaInicio) => {
          setDragOverDia(null)
          mover(id, dia, horaInicio)
        }}
        onClickVazio={(dia, horaInicio) => setModal({ aberto: true, modo: 'criar', data: dia, horaInicio })}
        onAbrirEvento={(e) => setModal({ aberto: true, modo: 'editar', evento: e })}
      />

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

// A grelha mostra das 7h às 21h, em contínuo — cada evento fica
// posicionado exatamente à sua hora e minuto (não há mais blocos fixos
// de 30 em 30 min a condicionar onde um evento pode ficar).
const GRADE_HORA_INICIO = 7
const GRADE_HORA_FIM = 21
const PX_POR_MINUTO = 1.3
const GRADE_MIN_INICIO = GRADE_HORA_INICIO * 60
const GRADE_ALTURA = (GRADE_HORA_FIM - GRADE_HORA_INICIO) * 60 * PX_POR_MINUTO
const HORAS_GRADE = Array.from(
  { length: GRADE_HORA_FIM - GRADE_HORA_INICIO + 1 },
  (_, i) => GRADE_HORA_INICIO + i
)

type EventoPosicionado = { evento: EventoComNomes; coluna: number; colunas: number }

// Dispõe os eventos do dia numa grelha contínua: eventos que se
// sobrepõem no tempo ficam lado a lado (como no Google Calendar), em
// vez de empilhados uns sobre os outros.
function disporEventosDoDia(eventosDia: EventoComNomes[]): EventoPosicionado[] {
  const ordenados = [...eventosDia].sort(
    (a, b) => minutosDoDia(a.hora_inicio) - minutosDoDia(b.hora_inicio)
  )
  const fimPorColuna: number[] = []
  const base = ordenados.map((evento) => {
    const inicio = minutosDoDia(evento.hora_inicio)
    const fim = inicio + evento.duracao_min
    let coluna = fimPorColuna.findIndex((f) => f <= inicio)
    if (coluna === -1) {
      coluna = fimPorColuna.length
      fimPorColuna.push(fim)
    } else {
      fimPorColuna[coluna] = fim
    }
    return { evento, coluna, inicio, fim }
  })
  return base.map((p) => {
    const simultaneos = base.filter((q) => q.inicio < p.fim && q.fim > p.inicio)
    const colunas = Math.max(...simultaneos.map((q) => q.coluna + 1))
    return { evento: p.evento, coluna: p.coluna, colunas }
  })
}

function minutoNoClique(clienteY: number, rectTop: number) {
  const minutos = GRADE_MIN_INICIO + Math.round((clienteY - rectTop) / PX_POR_MINUTO)
  return Math.max(GRADE_MIN_INICIO, Math.min(GRADE_HORA_FIM * 60 - 1, minutos))
}

function GrelhaInterativa({
  dias,
  porDia,
  dragOverDia,
  onDragOverDia,
  onDrop,
  onClickVazio,
  onAbrirEvento,
}: {
  dias: string[]
  porDia: Record<string, EventoComNomes[]>
  dragOverDia: string | null
  onDragOverDia: (dia: string | null) => void
  onDrop: (id: string, dia: string, horaInicio: string) => void
  onClickVazio: (dia: string, horaInicio: string) => void
  onAbrirEvento: (evento: EventoComNomes) => void
}) {
  // Um só dia (vista Dia) ocupa a largura toda; a semana continua a
  // precisar de largura mínima para as 7 colunas não ficarem espremidas.
  const colunas = `repeat(${dias.length}, 1fr)`
  const largura = dias.length > 1 ? 'min-w-[760px]' : 'min-w-[260px]'

  return (
    <div className="mt-4 overflow-x-auto">
      <p className="mb-2 text-xs text-muted">
        Clica num espaço vazio para criar à hora exata, clica num evento para editar, arrasta um
        evento para o mover — tudo minuto a minuto, sem ficar preso a blocos de meia hora.
      </p>
      <div className={largura}>
        <div className="grid" style={{ gridTemplateColumns: `48px ${colunas}` }}>
          <div />
          {dias.map((d, i) => (
            <div key={d} className="rounded-t-lg bg-brand/[.05] p-1 text-center text-xs font-semibold text-foreground">
              {dias.length > 1 ? DIAS_SEMANA[i] : DIAS_SEMANA[(new Date(`${d}T00:00:00`).getDay() + 6) % 7]}
              <br />
              <span className="font-normal text-muted">{fmt(d)}</span>
            </div>
          ))}
        </div>
        <div className="max-h-[65vh] overflow-y-auto rounded-b-xl border border-border-subtle">
          <div className="grid" style={{ gridTemplateColumns: `48px ${colunas}`, height: GRADE_ALTURA }}>
            <div className="relative text-[10px] text-muted">
              {HORAS_GRADE.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2"
                  style={{ top: (h * 60 - GRADE_MIN_INICIO) * PX_POR_MINUTO }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {dias.map((dia) => (
              <ColunaDia
                key={dia}
                eventos={porDia[dia] ?? []}
                emDrag={dragOverDia === dia}
                onDragOver={() => onDragOverDia(dia)}
                onDragLeave={() => onDragOverDia(null)}
                onDrop={(id, horaInicio) => onDrop(id, dia, horaInicio)}
                onClickVazio={(horaInicio) => onClickVazio(dia, horaInicio)}
                onAbrirEvento={onAbrirEvento}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ColunaDia({
  eventos,
  emDrag,
  onDragOver,
  onDragLeave,
  onDrop,
  onClickVazio,
  onAbrirEvento,
}: {
  eventos: EventoComNomes[]
  emDrag: boolean
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (id: string, horaInicio: string) => void
  onClickVazio: (horaInicio: string) => void
  onAbrirEvento: (evento: EventoComNomes) => void
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        const rect = e.currentTarget.getBoundingClientRect()
        if (id) onDrop(id, minutosParaHora(minutoNoClique(e.clientY, rect.top)))
      }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onClickVazio(minutosParaHora(minutoNoClique(e.clientY, rect.top)))
      }}
      className={`relative cursor-pointer border-l border-border-subtle bg-surface transition-colors ${
        emDrag ? 'bg-brand/[.1]' : ''
      }`}
    >
      {HORAS_GRADE.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-border-subtle/60"
          style={{ top: (h * 60 - GRADE_MIN_INICIO) * PX_POR_MINUTO }}
        />
      ))}
      {disporEventosDoDia(eventos).map(({ evento, coluna, colunas }) => {
        const cor = corTipoEvento(evento.tipo)
        const inicioMin = minutosDoDia(evento.hora_inicio)
        return (
          <button
            key={evento.id}
            type="button"
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData('text/plain', evento.id)
              ev.dataTransfer.effectAllowed = 'move'
            }}
            onClick={(ev) => {
              ev.stopPropagation()
              onAbrirEvento(evento)
            }}
            className={`absolute overflow-hidden rounded border px-1 py-0.5 text-left leading-tight ${
              evento.estado === 'Cancelado' ? 'opacity-50 line-through' : ''
            }`}
            style={{
              top: (inicioMin - GRADE_MIN_INICIO) * PX_POR_MINUTO,
              height: Math.max(evento.duracao_min * PX_POR_MINUTO, 18),
              left: `${(coluna * 100) / colunas}%`,
              width: `${100 / colunas}%`,
              background: cor.bg,
              color: cor.tx,
              borderColor: cor.tx,
            }}
          >
            <span className="block truncate text-[9px] font-semibold">
              {evento.hora_inicio.slice(0, 5)}–{horaFim(evento.hora_inicio, evento.duracao_min)}
            </span>
            <span className="block truncate text-[10px] font-medium">{rotuloEvento(evento)}</span>
          </button>
        )
      })}
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
            <input
              type="number"
              name="duracao_min"
              min={5}
              max={240}
              step={1}
              list="duracoes-comuns-modal"
              defaultValue={evento?.duracao_min ?? 40}
              required
              className={inputCls}
              title="Duração em minutos — qualquer valor, não só os sugeridos"
            />
            <datalist id="duracoes-comuns-modal">
              {DURACOES_COMUNS.map((min) => (
                <option key={min} value={min} />
              ))}
            </datalist>
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
