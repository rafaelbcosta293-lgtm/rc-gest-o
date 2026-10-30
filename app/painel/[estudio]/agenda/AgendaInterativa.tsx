'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Trash2, Ban, RotateCcw, Minus, Plus } from 'lucide-react'
import ClienteCombobox, { type ClienteOpcao } from '@/components/ClienteCombobox'
import { corTipoEvento, TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
import { fmt, DIAS_SEMANA } from '@/lib/data/presencas'
import {
  criarEventoRapido,
  atualizarEventoRapido,
  moverEventoRapido,
  redimensionarEventoRapido,
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
  | { aberto: true; modo: 'criar'; data: string; horaInicio: string; duracaoMin: number }
  | { aberto: true; modo: 'editar'; evento: EventoComNomes }

// Níveis de zoom (pixels por minuto) — o valor por omissão mostra o dia
// inteiro (00h–24h) sem precisar de scroll na maioria dos ecrãs; os
// níveis seguintes aproximam para marcar/ver detalhe ao minuto.
const NIVEIS_ZOOM = [0.3, 0.45, 0.65, 0.9, 1.3, 1.8, 2.4]
const ZOOM_OMISSAO = 1

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
  const [zoomIndice, setZoomIndice] = useState(ZOOM_OMISSAO)
  const [aPendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const pxPorMinuto = NIVEIS_ZOOM[zoomIndice]

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

  function redimensionar(id: string, horaInicio: string, duracaoMin: number) {
    iniciarTransicao(async () => {
      const resultado = await redimensionarEventoRapido({ estudioSlug: slug, id, horaInicio, duracaoMin })
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
        onRedimensionar={redimensionar}
        onClickVazio={(dia, horaInicio, duracaoMin) =>
          setModal({ aberto: true, modo: 'criar', data: dia, horaInicio, duracaoMin })
        }
        onAbrirEvento={(e) => setModal({ aberto: true, modo: 'editar', evento: e })}
        pxPorMinuto={pxPorMinuto}
        zoomIndice={zoomIndice}
        onZoomIndiceChange={setZoomIndice}
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

// A grelha mostra o dia inteiro, das 00h00 às 24h00 — cada evento fica
// posicionado exatamente à sua hora e minuto (não há blocos fixos de
// meia hora a condicionar onde um evento pode ficar).
const GRADE_HORA_INICIO = 0
const GRADE_HORA_FIM = 24
const HORAS_GRADE = Array.from(
  { length: GRADE_HORA_FIM - GRADE_HORA_INICIO + 1 },
  (_, i) => GRADE_HORA_INICIO + i
)
const DURACAO_MIN_MINIMA = 5

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

function minutoNoClique(clienteY: number, rectTop: number, pxPorMinuto: number) {
  const minutos = Math.round((clienteY - rectTop) / pxPorMinuto)
  return Math.max(0, Math.min(GRADE_HORA_FIM * 60 - 1, minutos))
}

function GrelhaInterativa({
  dias,
  porDia,
  dragOverDia,
  onDragOverDia,
  onDrop,
  onRedimensionar,
  onClickVazio,
  onAbrirEvento,
  pxPorMinuto,
  zoomIndice,
  onZoomIndiceChange,
}: {
  dias: string[]
  porDia: Record<string, EventoComNomes[]>
  dragOverDia: string | null
  onDragOverDia: (dia: string | null) => void
  onDrop: (id: string, dia: string, horaInicio: string) => void
  onRedimensionar: (id: string, horaInicio: string, duracaoMin: number) => void
  onClickVazio: (dia: string, horaInicio: string, duracaoMin: number) => void
  onAbrirEvento: (evento: EventoComNomes) => void
  pxPorMinuto: number
  zoomIndice: number
  onZoomIndiceChange: (indice: number) => void
}) {
  // Um só dia (vista Dia) ocupa a largura toda; a semana continua a
  // precisar de largura mínima para as 7 colunas não ficarem espremidas.
  const colunas = `repeat(${dias.length}, 1fr)`
  const largura = dias.length > 1 ? 'min-w-[760px]' : 'min-w-[260px]'
  const alturaGrade = GRADE_HORA_FIM * 60 * pxPorMinuto

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Clica e arrasta num espaço vazio para criar com a duração exata (um clique simples usa
          40 min), arrasta o meio de um evento para o mover, o topo ou o fundo para
          encurtar/alongar.
        </p>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-pop">
          <button
            type="button"
            onClick={() => onZoomIndiceChange(Math.max(0, zoomIndice - 1))}
            disabled={zoomIndice === 0}
            title="Diminuir zoom"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-brand/[.08] hover:text-foreground disabled:opacity-30"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-9 text-center text-[11px] font-semibold text-muted">
            {Math.round((pxPorMinuto / NIVEIS_ZOOM[ZOOM_OMISSAO]) * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomIndiceChange(Math.min(NIVEIS_ZOOM.length - 1, zoomIndice + 1))}
            disabled={zoomIndice === NIVEIS_ZOOM.length - 1}
            title="Aumentar zoom"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-brand/[.08] hover:text-foreground disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
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
        <div className="max-h-[75vh] overflow-y-auto rounded-b-xl border border-border-subtle">
          <div className="grid" style={{ gridTemplateColumns: `48px ${colunas}`, height: alturaGrade }}>
            <div className="relative text-[10px] text-muted">
              {HORAS_GRADE.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2"
                  style={{ top: h * 60 * pxPorMinuto }}
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
                onRedimensionar={onRedimensionar}
                onClickVazio={(horaInicio, duracaoMin) => onClickVazio(dia, horaInicio, duracaoMin)}
                onAbrirEvento={onAbrirEvento}
                pxPorMinuto={pxPorMinuto}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Um só arrasto por coluna de cada vez — ou a criar um evento novo
// (a partir de um espaço vazio) ou a redimensionar um existente (a
// partir de uma das pegas). Guardado em ref (não state) para o
// mousemove/mouseup no window ler sempre o valor mais recente, sem
// obrigar a re-subscrever os listeners a cada pixel arrastado.
type ArrastoColuna =
  | { tipo: 'criar'; inicioMin: number }
  | { tipo: 'redimensionar'; evento: EventoComNomes; pega: 'topo' | 'fundo' }

function ColunaDia({
  eventos,
  emDrag,
  onDragOver,
  onDragLeave,
  onDrop,
  onRedimensionar,
  onClickVazio,
  onAbrirEvento,
  pxPorMinuto,
}: {
  eventos: EventoComNomes[]
  emDrag: boolean
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (id: string, horaInicio: string) => void
  onRedimensionar: (id: string, horaInicio: string, duracaoMin: number) => void
  onClickVazio: (horaInicio: string, duracaoMin: number) => void
  onAbrirEvento: (evento: EventoComNomes) => void
  pxPorMinuto: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const arrastoRef = useRef<ArrastoColuna | null>(null)
  const [previa, setPrevia] = useState<{ inicioMin: number; fimMin: number } | null>(null)

  useEffect(() => {
    function minutoDoEvento(e: MouseEvent) {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return null
      return minutoNoClique(e.clientY, rect.top, pxPorMinuto)
    }

    function mover(e: MouseEvent) {
      const arrasto = arrastoRef.current
      if (!arrasto) return
      const min = minutoDoEvento(e)
      if (min === null) return

      if (arrasto.tipo === 'criar') {
        setPrevia({ inicioMin: Math.min(arrasto.inicioMin, min), fimMin: Math.max(arrasto.inicioMin, min) })
        return
      }

      const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
      const fimOriginal = inicioOriginal + arrasto.evento.duracao_min
      if (arrasto.pega === 'topo') {
        const novoInicio = Math.min(min, fimOriginal - DURACAO_MIN_MINIMA)
        setPrevia({ inicioMin: novoInicio, fimMin: fimOriginal })
      } else {
        const novoFim = Math.max(min, inicioOriginal + DURACAO_MIN_MINIMA)
        setPrevia({ inicioMin: inicioOriginal, fimMin: novoFim })
      }
    }

    function soltar(e: MouseEvent) {
      const arrasto = arrastoRef.current
      if (!arrasto) return
      arrastoRef.current = null
      setPrevia(null)
      const min = minutoDoEvento(e)
      if (min === null) return

      if (arrasto.tipo === 'criar') {
        const inicio = Math.min(arrasto.inicioMin, min)
        const fim = Math.max(arrasto.inicioMin, min)
        const duracaoArrastada = fim - inicio
        onClickVazio(minutosParaHora(inicio), duracaoArrastada >= 15 ? duracaoArrastada : 40)
        return
      }

      const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
      const fimOriginal = inicioOriginal + arrasto.evento.duracao_min
      const novoInicio = arrasto.pega === 'topo' ? Math.min(min, fimOriginal - DURACAO_MIN_MINIMA) : inicioOriginal
      const novoFim = arrasto.pega === 'fundo' ? Math.max(min, inicioOriginal + DURACAO_MIN_MINIMA) : fimOriginal
      if (novoInicio === inicioOriginal && novoFim === fimOriginal) return
      onRedimensionar(arrasto.evento.id, minutosParaHora(novoInicio), novoFim - novoInicio)
    }

    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
    return () => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
    }
  }, [pxPorMinuto, onClickVazio, onRedimensionar])

  function iniciarCriacao(e: React.MouseEvent) {
    if (e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const min = minutoNoClique(e.clientY, rect.top, pxPorMinuto)
    arrastoRef.current = { tipo: 'criar', inicioMin: min }
    setPrevia({ inicioMin: min, fimMin: min })
  }

  function iniciarRedimensionamento(evento: EventoComNomes, pega: 'topo' | 'fundo') {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      arrastoRef.current = { tipo: 'redimensionar', evento, pega }
      setPrevia({ inicioMin: minutosDoDia(evento.hora_inicio), fimMin: minutosDoDia(evento.hora_inicio) + evento.duracao_min })
    }
  }

  return (
    <div
      ref={ref}
      onMouseDown={iniciarCriacao}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        const rect = e.currentTarget.getBoundingClientRect()
        if (id) onDrop(id, minutosParaHora(minutoNoClique(e.clientY, rect.top, pxPorMinuto)))
      }}
      className={`relative cursor-pointer border-l border-border-subtle bg-surface transition-colors select-none ${
        emDrag ? 'bg-brand/[.1]' : ''
      }`}
    >
      {HORAS_GRADE.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-border-subtle/60"
          style={{ top: h * 60 * pxPorMinuto }}
        />
      ))}
      {previa && (
        <div
          className="pointer-events-none absolute inset-x-1 rounded border-2 border-dashed border-brand bg-brand/20"
          style={{
            top: previa.inicioMin * pxPorMinuto,
            height: Math.max((previa.fimMin - previa.inicioMin) * pxPorMinuto, 4),
          }}
        />
      )}
      {disporEventosDoDia(eventos).map(({ evento, coluna, colunas }) => {
        const cor = corTipoEvento(evento.tipo)
        const inicioMin = minutosDoDia(evento.hora_inicio)
        return (
          <button
            key={evento.id}
            type="button"
            draggable
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(ev) => {
              ev.dataTransfer.setData('text/plain', evento.id)
              ev.dataTransfer.effectAllowed = 'move'
            }}
            onClick={(ev) => {
              ev.stopPropagation()
              onAbrirEvento(evento)
            }}
            className={`group absolute overflow-hidden rounded border px-1 py-0.5 text-left leading-tight ${
              evento.estado === 'Cancelado' ? 'opacity-50 line-through' : ''
            }`}
            style={{
              top: inicioMin * pxPorMinuto,
              height: Math.max(evento.duracao_min * pxPorMinuto, 18),
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
            {/* Pegas de redimensionar, ao estilo Google Calendar — só o
                cursor muda de resto; ficam discretas até se precisar
                delas. */}
            <span
              onMouseDown={iniciarRedimensionamento(evento, 'topo')}
              className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
            />
            <span
              onMouseDown={iniciarRedimensionamento(evento, 'fundo')}
              className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
            />
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
  const duracaoDefault = modal.modo === 'editar' ? modal.evento.duracao_min : modal.duracaoMin

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
              max={1440}
              step={1}
              list="duracoes-comuns-modal"
              defaultValue={duracaoDefault}
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
