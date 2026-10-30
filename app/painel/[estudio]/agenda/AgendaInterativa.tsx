'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
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

// Treinos em simultâneo guardam uma linha por pessoa (grupo_id
// partilhado) — o rótulo junta os nomes para se ver logo quem treina
// junto, sem abrir o evento.
function rotuloEvento(grupo: EventoComNomes[]) {
  const nomes = grupo.map((e) => e.cliente?.nome).filter((n): n is string => !!n)
  if (nomes.length > 0) return nomes.join(' + ')
  return grupo[0].titulo ?? grupo[0].tipo
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
  // grupo inclui sempre o próprio evento — tem 1 elemento quando é só
  // uma pessoa, vários quando é um treino em simultâneo.
  | { aberto: true; modo: 'editar'; evento: EventoComNomes; grupo: EventoComNomes[] }

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
    const grupoId = eventos.find((e) => e.id === id)?.grupo_id ?? null
    iniciarTransicao(async () => {
      const resultado = await moverEventoRapido({
        estudioSlug: slug,
        id,
        grupoId,
        data: novaData,
        horaInicio: novaHoraInicio,
      })
      if ('error' in resultado) setErro(resultado.error)
      else router.refresh()
    })
  }

  function redimensionar(id: string, horaInicio: string, duracaoMin: number) {
    const grupoId = eventos.find((e) => e.id === id)?.grupo_id ?? null
    iniciarTransicao(async () => {
      const resultado = await redimensionarEventoRapido({ estudioSlug: slug, id, grupoId, horaInicio, duracaoMin })
      if ('error' in resultado) setErro(resultado.error)
      else router.refresh()
    })
  }

  function aoSubmeter(formData: FormData, clienteIds: string[]) {
    const campos = {
      estudioSlug: slug,
      tipo: formData.get('tipo') as TipoEvento,
      clienteIds,
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
          ? await atualizarEventoRapido({
              ...campos,
              id: modal.evento.id,
              grupoId: modal.evento.grupo_id,
              estudioId,
            })
          : await criarEventoRapido({ ...campos, estudioId })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function desmarcar() {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const { id, grupo_id } = modal.evento
    iniciarTransicao(async () => {
      const resultado = await desmarcarEventoRapido({ estudioSlug: slug, id, grupoId: grupo_id, motivo: null })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function reativar() {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const { id, grupo_id } = modal.evento
    iniciarTransicao(async () => {
      const resultado = await reativarEventoRapido({ estudioSlug: slug, id, grupoId: grupo_id })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function apagar() {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const aviso =
      modal.grupo.length > 1
        ? 'Apagar este treino em simultâneo? Remove todas as pessoas. Não é possível desfazer.'
        : 'Apagar este evento? Não é possível desfazer.'
    if (!window.confirm(aviso)) return
    const { id, grupo_id } = modal.evento
    iniciarTransicao(async () => {
      const resultado = await apagarEventoRapido({ estudioSlug: slug, id, grupoId: grupo_id })
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

  function abrirParaEditar(evento: EventoComNomes) {
    const grupo = evento.grupo_id ? eventos.filter((e) => e.grupo_id === evento.grupo_id) : [evento]
    setModal({ aberto: true, modo: 'editar', evento, grupo })
  }

  return (
    <>
      <GrelhaInterativa
        dias={dias}
        porDia={porDia}
        onMover={mover}
        onRedimensionar={redimensionar}
        onClickVazio={(dia, horaInicio, duracaoMin) =>
          setModal({ aberto: true, modo: 'criar', data: dia, horaInicio, duracaoMin })
        }
        onAbrirEvento={abrirParaEditar}
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

type EventoPosicionado = { evento: EventoComNomes; grupo: EventoComNomes[]; coluna: number; colunas: number }

// Um treino em simultâneo tem uma linha por pessoa — todas com o mesmo
// grupo_id — mas só deve ocupar UM bloco na grelha (com todos os nomes),
// em vez de aparecerem lado a lado como se fossem eventos diferentes.
function representantesDoDia(eventosDia: EventoComNomes[]): { evento: EventoComNomes; grupo: EventoComNomes[] }[] {
  const vistos = new Set<string>()
  const resultado: { evento: EventoComNomes; grupo: EventoComNomes[] }[] = []
  for (const e of eventosDia) {
    if (vistos.has(e.id)) continue
    if (e.grupo_id) {
      const grupo = eventosDia.filter((x) => x.grupo_id === e.grupo_id)
      grupo.forEach((x) => vistos.add(x.id))
      resultado.push({ evento: e, grupo })
    } else {
      vistos.add(e.id)
      resultado.push({ evento: e, grupo: [e] })
    }
  }
  return resultado
}

// Dispõe os eventos do dia numa grelha contínua: eventos que se
// sobrepõem no tempo ficam lado a lado (como no Google Calendar), em
// vez de empilhados uns sobre os outros.
function disporEventosDoDia(eventosDia: EventoComNomes[]): EventoPosicionado[] {
  const ordenados = [...representantesDoDia(eventosDia)].sort(
    (a, b) => minutosDoDia(a.evento.hora_inicio) - minutosDoDia(b.evento.hora_inicio)
  )
  const fimPorColuna: number[] = []
  const base = ordenados.map((r) => {
    const inicio = minutosDoDia(r.evento.hora_inicio)
    const fim = inicio + r.evento.duracao_min
    let coluna = fimPorColuna.findIndex((f) => f <= inicio)
    if (coluna === -1) {
      coluna = fimPorColuna.length
      fimPorColuna.push(fim)
    } else {
      fimPorColuna[coluna] = fim
    }
    return { ...r, coluna, inicio, fim }
  })
  return base.map((p) => {
    const simultaneos = base.filter((q) => q.inicio < p.fim && q.fim > p.inicio)
    const colunas = Math.max(...simultaneos.map((q) => q.coluna + 1))
    return { evento: p.evento, grupo: p.grupo, coluna: p.coluna, colunas }
  })
}

// Arredondado aos 10 minutos aqui, na origem — para a caixa que
// acompanha o rato, a pré-visualização e a hora final gravada serem
// sempre exatamente o mesmo valor (nunca a pré-visualização encostar a
// uma hora redonda e a marcação ficar gravada uns minutos ao lado).
function minutoNoClique(clienteY: number, rectTop: number, pxPorMinuto: number) {
  const minutosExatos = (clienteY - rectTop) / pxPorMinuto
  const minutos = Math.round(minutosExatos / 10) * 10
  return Math.max(0, Math.min(GRADE_HORA_FIM * 60 - 10, minutos))
}

// Um só arrasto de cada vez — a criar um evento novo (a partir de um
// espaço vazio), a redimensionar um existente (a partir de uma pega) ou
// a mover um existente (a partir do meio) — pode atravessar colunas
// (dias) diferentes, por isso vive aqui, não em cada coluna. Em ref
// (não state): o mousemove no window tem de ler sempre o valor mais
// recente sem obrigar a re-subscrever os listeners a cada pixel.
type Arrasto =
  | { tipo: 'criar'; dia: string; inicioMin: number }
  | { tipo: 'redimensionar'; evento: EventoComNomes; pega: 'topo' | 'fundo' }
  | { tipo: 'mover'; evento: EventoComNomes }

function GrelhaInterativa({
  dias,
  porDia,
  onMover,
  onRedimensionar,
  onClickVazio,
  onAbrirEvento,
  pxPorMinuto,
  zoomIndice,
  onZoomIndiceChange,
}: {
  dias: string[]
  porDia: Record<string, EventoComNomes[]>
  onMover: (id: string, dia: string, horaInicio: string) => void
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

  const colRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const arrastoRef = useRef<Arrasto | null>(null)
  // Fica true assim que um arrasto de "mover" se desloca de verdade —
  // o clique que abre a ficha do evento olha para isto a seguir ao
  // mouseup, para não abrir o modal logo depois de reagendar.
  const ignorarProximoClickRef = useRef(false)

  const [previa, setPrevia] = useState<{ dia: string; inicioMin: number; fimMin: number } | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  // Hora sob o rato — acompanha sempre o cursor (ao contrário da régua
  // antiga, fixa na coluna da esquerda), tanto em repouso como durante
  // qualquer arrasto, arredondada aos 10 minutos.
  const [cursor, setCursor] = useState<{ x: number; y: number; minuto: number } | null>(null)

  function registarRef(dia: string) {
    return (el: HTMLDivElement | null) => {
      colRefs.current[dia] = el
    }
  }

  const localizar = useCallback(
    (clientX: number, clientY: number): { dia: string; minuto: number } | null => {
      for (const dia of dias) {
        const el = colRefs.current[dia]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return { dia, minuto: minutoNoClique(clientY, rect.top, pxPorMinuto) }
        }
      }
      return null
    },
    [dias, pxPorMinuto]
  )

  useEffect(() => {
    function mover(e: MouseEvent) {
      const loc = localizar(e.clientX, e.clientY)
      if (loc) setCursor({ x: e.clientX, y: e.clientY, minuto: loc.minuto })

      const arrasto = arrastoRef.current
      if (!arrasto || !loc) return

      if (arrasto.tipo === 'criar') {
        setPrevia({
          dia: arrasto.dia,
          inicioMin: Math.min(arrasto.inicioMin, loc.minuto),
          fimMin: Math.max(arrasto.inicioMin, loc.minuto),
        })
      } else if (arrasto.tipo === 'redimensionar') {
        const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
        const fimOriginal = inicioOriginal + arrasto.evento.duracao_min
        if (arrasto.pega === 'topo') {
          setPrevia({
            dia: arrasto.evento.data,
            inicioMin: Math.min(loc.minuto, fimOriginal - DURACAO_MIN_MINIMA),
            fimMin: fimOriginal,
          })
        } else {
          setPrevia({
            dia: arrasto.evento.data,
            inicioMin: inicioOriginal,
            fimMin: Math.max(loc.minuto, inicioOriginal + DURACAO_MIN_MINIMA),
          })
        }
      } else {
        const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
        if (loc.dia !== arrasto.evento.data || loc.minuto !== inicioOriginal) {
          ignorarProximoClickRef.current = true
        }
        setPrevia({ dia: loc.dia, inicioMin: loc.minuto, fimMin: loc.minuto + arrasto.evento.duracao_min })
      }
    }

    function soltar(e: MouseEvent) {
      const arrasto = arrastoRef.current
      if (!arrasto) return
      arrastoRef.current = null
      setPrevia(null)
      setArrastandoId(null)
      const loc = localizar(e.clientX, e.clientY)
      if (!loc) return

      if (arrasto.tipo === 'criar') {
        const inicio = Math.min(arrasto.inicioMin, loc.minuto)
        const fim = Math.max(arrasto.inicioMin, loc.minuto)
        const duracaoArrastada = fim - inicio
        onClickVazio(arrasto.dia, minutosParaHora(inicio), duracaoArrastada >= 15 ? duracaoArrastada : 40)
        return
      }

      if (arrasto.tipo === 'redimensionar') {
        const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
        const fimOriginal = inicioOriginal + arrasto.evento.duracao_min
        const novoInicio = arrasto.pega === 'topo' ? Math.min(loc.minuto, fimOriginal - DURACAO_MIN_MINIMA) : inicioOriginal
        const novoFim = arrasto.pega === 'fundo' ? Math.max(loc.minuto, inicioOriginal + DURACAO_MIN_MINIMA) : fimOriginal
        if (novoInicio !== inicioOriginal || novoFim !== fimOriginal) {
          onRedimensionar(arrasto.evento.id, minutosParaHora(novoInicio), novoFim - novoInicio)
        }
        return
      }

      const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
      if (loc.dia !== arrasto.evento.data || loc.minuto !== inicioOriginal) {
        onMover(arrasto.evento.id, loc.dia, minutosParaHora(loc.minuto))
      }
    }

    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
    return () => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
    }
  }, [localizar, onClickVazio, onRedimensionar, onMover])

  function aoMoverRatoEmRepouso(e: React.MouseEvent) {
    if (arrastoRef.current) return
    const loc = localizar(e.clientX, e.clientY)
    if (loc) setCursor({ x: e.clientX, y: e.clientY, minuto: loc.minuto })
  }

  function iniciarCriacao(dia: string) {
    return (e: React.MouseEvent) => {
      if (e.button !== 0) return
      const loc = localizar(e.clientX, e.clientY)
      const inicioMin = loc?.minuto ?? 0
      arrastoRef.current = { tipo: 'criar', dia, inicioMin }
      setPrevia({ dia, inicioMin, fimMin: inicioMin })
    }
  }

  function iniciarRedimensionamento(evento: EventoComNomes, pega: 'topo' | 'fundo') {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      arrastoRef.current = { tipo: 'redimensionar', evento, pega }
      setPrevia({
        dia: evento.data,
        inicioMin: minutosDoDia(evento.hora_inicio),
        fimMin: minutosDoDia(evento.hora_inicio) + evento.duracao_min,
      })
    }
  }

  function iniciarMovimento(evento: EventoComNomes) {
    return (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      ignorarProximoClickRef.current = false
      arrastoRef.current = { tipo: 'mover', evento }
      setArrastandoId(evento.id)
      setPrevia({
        dia: evento.data,
        inicioMin: minutosDoDia(evento.hora_inicio),
        fimMin: minutosDoDia(evento.hora_inicio) + evento.duracao_min,
      })
    }
  }

  function aoClicarEvento(evento: EventoComNomes) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      if (ignorarProximoClickRef.current) {
        ignorarProximoClickRef.current = false
        return
      }
      onAbrirEvento(evento)
    }
  }

  return (
    <div
      className="mt-4 overflow-x-auto"
      onMouseLeave={() => {
        if (!arrastoRef.current) setCursor(null)
      }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          A hora acompanha sempre o rato (de 10 em 10 min); clica e arrasta num espaço vazio para
          criar com essa duração (um clique simples usa 40 min); arrasta o meio de um evento para o
          mover, o topo ou o fundo para encurtar/alongar.
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
        <div
          onMouseMove={aoMoverRatoEmRepouso}
          className="h-[calc(100vh-280px)] min-h-[360px] overflow-y-auto rounded-b-xl border border-border-subtle"
        >
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
                registarRef={registarRef(dia)}
                onIniciarCriacao={iniciarCriacao(dia)}
                onIniciarRedimensionamento={iniciarRedimensionamento}
                onIniciarMovimento={iniciarMovimento}
                onClicarEvento={aoClicarEvento}
                arrastandoId={arrastandoId}
                previa={previa?.dia === dia ? previa : null}
                pxPorMinuto={pxPorMinuto}
              />
            ))}
          </div>
        </div>
      </div>

      {/* A hora segue o cursor em qualquer sítio da grelha — posição
          fixa ao ecrã, por isso não é afetada pelo scroll interno. */}
      {cursor && (
        <div
          className="pointer-events-none fixed z-30 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white shadow-pop"
          style={{ left: cursor.x + 14, top: cursor.y - 10 }}
        >
          {minutosParaHora(cursor.minuto)}
        </div>
      )}
    </div>
  )
}

function ColunaDia({
  eventos,
  registarRef,
  onIniciarCriacao,
  onIniciarRedimensionamento,
  onIniciarMovimento,
  onClicarEvento,
  arrastandoId,
  previa,
  pxPorMinuto,
}: {
  eventos: EventoComNomes[]
  registarRef: (el: HTMLDivElement | null) => void
  onIniciarCriacao: (e: React.MouseEvent) => void
  onIniciarRedimensionamento: (evento: EventoComNomes, pega: 'topo' | 'fundo') => (e: React.MouseEvent) => void
  onIniciarMovimento: (evento: EventoComNomes) => (e: React.MouseEvent) => void
  onClicarEvento: (evento: EventoComNomes) => (e: React.MouseEvent) => void
  arrastandoId: string | null
  previa: { inicioMin: number; fimMin: number } | null
  pxPorMinuto: number
}) {
  return (
    <div
      ref={registarRef}
      onMouseDown={onIniciarCriacao}
      className="relative cursor-pointer border-l border-border-subtle bg-surface transition-colors select-none"
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
      {disporEventosDoDia(eventos).map(({ evento, grupo, coluna, colunas }) => {
        const cor = corTipoEvento(evento.tipo)
        const inicioMin = minutosDoDia(evento.hora_inicio)
        const emArrasto = arrastandoId === evento.id
        return (
          <button
            key={evento.id}
            type="button"
            onMouseDown={onIniciarMovimento(evento)}
            onClick={onClicarEvento(evento)}
            className={`group absolute overflow-hidden rounded border px-1 py-0.5 text-left leading-tight transition-opacity ${
              evento.estado === 'Cancelado' ? 'opacity-50 line-through' : ''
            } ${emArrasto ? 'opacity-30' : ''}`}
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
            <span className="block truncate text-[10px] font-medium">{rotuloEvento(grupo)}</span>
            {/* Pegas de redimensionar, ao estilo Google Calendar — só o
                cursor muda de resto; ficam discretas até se precisar
                delas. */}
            <span
              onMouseDown={onIniciarRedimensionamento(evento, 'topo')}
              className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
            />
            <span
              onMouseDown={onIniciarRedimensionamento(evento, 'fundo')}
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
  onSubmeter: (formData: FormData, clienteIds: string[]) => void
  onDesmarcar: () => void
  onReativar: () => void
  onApagar: () => void
}) {
  const editar = modal.modo === 'editar'
  const evento = modal.modo === 'editar' ? modal.evento : null
  const dataDefault = modal.modo === 'editar' ? modal.evento.data : modal.data
  const horaDefault = modal.modo === 'editar' ? modal.evento.hora_inicio.slice(0, 5) : modal.horaInicio
  const duracaoDefault = modal.modo === 'editar' ? modal.evento.duracao_min : modal.duracaoMin

  // Quem já está neste treino — para um treino em simultâneo, o grupo
  // tem mais do que uma pessoa; pode-se adicionar ou remover enquanto
  // se edita, e guardar aplica a todas.
  const [participantes, setParticipantes] = useState<ClienteOpcao[]>(() =>
    modal.modo === 'editar'
      ? modal.grupo
          .map((e) => e.cliente)
          .filter((c): c is ClienteOpcao => c !== null)
      : []
  )

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

        {participantes.length > 1 && (
          <p className="mt-2 rounded-lg bg-brand/[.06] px-3 py-2 text-xs text-muted">
            Treino em simultâneo — guardar, mover, desmarcar ou apagar aplica-se a todas as
            pessoas.
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
            onSubmeter(
              new FormData(e.currentTarget),
              participantes.map((c) => c.id)
            )
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

          <div className="flex flex-col gap-1.5">
            {participantes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participantes.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full bg-brand/[.12] px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    {c.nome}
                    <button
                      type="button"
                      onClick={() => setParticipantes((lista) => lista.filter((x) => x.id !== c.id))}
                      className="text-muted hover:text-foreground"
                      title={`Remover ${c.nome} deste treino`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <ClienteCombobox
              clientes={clientes}
              excluirIds={participantes.map((c) => c.id)}
              onSelecionar={(c) => setParticipantes((lista) => [...lista, c])}
              placeholder={
                participantes.length === 0
                  ? '— Reunião / outro (sem cliente) — ou escreve para adicionar'
                  : 'Adicionar mais alguém ao mesmo treino…'
              }
            />
          </div>

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
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong disabled:opacity-60"
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
