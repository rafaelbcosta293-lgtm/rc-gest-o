"use client"

import { Fragment, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { CalendarXIcon, LockIcon, PlusIcon, UserRoundXIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatarDiaCurto, formatarDiaSemanaCurto } from "@/lib/datas"
import { cn } from "@/lib/utils"
import { ConteudoCartaoCompacto, ConteudoCartaoGrande } from "./cartao-trabalho"
import {
  chaveCelula,
  compararTrabalhos,
  podeMover,
  urlNovoTrabalho,
  type Ausente,
  type Ausentes,
  type DiaAgenda,
  type LinhaEquipa,
  type TrabalhoAgenda,
} from "./tipos"
import { useAgendaOtimista } from "./use-agenda-otimista"

type Props = {
  dias: DiaAgenda[]
  linhas: LinhaEquipa[]
  trabalhos: TrabalhoAgenda[]
  ausentes: Ausentes
  /** Ligação para a vista do dia (cabeçalho de cada dia). */
  hrefDia: Record<string, string>
}

type DestinoCelula = { data: string; equipaId: string | null }

function agruparPorCelula(trabalhos: TrabalhoAgenda[]) {
  const celulas = new Map<string, TrabalhoAgenda[]>()
  for (const trabalho of trabalhos) {
    const chave = chaveCelula(trabalho.equipaId, trabalho.data)
    celulas.set(chave, [...(celulas.get(chave) ?? []), trabalho])
  }
  for (const lista of celulas.values()) lista.sort(compararTrabalhos)
  return celulas
}

export function VistaSemana({ dias, linhas, trabalhos, ausentes, hrefDia }: Props) {
  const { lista, mover } = useAgendaOtimista(trabalhos)
  const celulas = useMemo(() => agruparPorCelula(lista), [lista])

  return (
    <>
      <div className="hidden md:block">
        <GrelhaSemana
          dias={dias}
          linhas={linhas}
          trabalhos={lista}
          celulas={celulas}
          ausentes={ausentes}
          hrefDia={hrefDia}
          mover={mover}
        />
      </div>
      <div className="md:hidden">
        <ListaSemana dias={dias} linhas={linhas} celulas={celulas} ausentes={ausentes} hrefDia={hrefDia} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------
// PC: grelha dias × equipas com arrastar e largar
// ---------------------------------------------------------------------

/** Espaço inicia o arrastar (Enter continua a abrir o trabalho); Espaço ou Enter largam. */
const TECLAS = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] }

const DIRECOES: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
}

/** Com o teclado, as setas saltam para a célula vizinha nessa direção. */
const coordenadasTeclado: KeyboardCoordinateGetter = (evento, { context }) => {
  const direcao = DIRECOES[evento.code]
  if (!direcao) return undefined
  evento.preventDefault()
  const { collisionRect, droppableRects, droppableContainers, over } = context
  const origem = (over && droppableRects.get(over.id)) ?? collisionRect
  if (!origem) return undefined
  const cx = origem.left + origem.width / 2
  const cy = origem.top + origem.height / 2

  let melhor: { left: number; top: number } | null = null
  let menor = Number.POSITIVE_INFINITY
  for (const celula of droppableContainers.getEnabled()) {
    if (celula.id === over?.id) continue
    const retangulo = droppableRects.get(celula.id)
    if (!retangulo) continue
    const dx = retangulo.left + retangulo.width / 2 - cx
    const dy = retangulo.top + retangulo.height / 2 - cy
    const nessaDirecao = dx * direcao[0] + dy * direcao[1]
    if (nessaDirecao <= 1) continue
    const desvio = Math.abs(dx * direcao[1]) + Math.abs(dy * direcao[0])
    const distancia = nessaDirecao + desvio * 3
    if (distancia < menor) {
      menor = distancia
      melhor = retangulo
    }
  }
  return melhor ? { x: melhor.left + 4, y: melhor.top + 4 } : undefined
}

/** Com o rato usa a posição do ponteiro; com o teclado, a sobreposição do cartão. */
const detetarColisao: CollisionDetection = (args) => {
  const ponteiro = pointerWithin(args)
  return ponteiro.length > 0 ? ponteiro : rectIntersection(args)
}

function GrelhaSemana({
  dias,
  linhas,
  trabalhos,
  celulas,
  ausentes,
  hrefDia,
  mover,
}: Omit<Props, "trabalhos"> & {
  trabalhos: TrabalhoAgenda[]
  celulas: Map<string, TrabalhoAgenda[]>
  mover: (id: string, data: string, equipaId: string | null) => void
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasTeclado, keyboardCodes: TECLAS })
  )
  const [ativo, setAtivo] = useState<TrabalhoAgenda | null>(null)
  // Depois de largar, o browser pode gerar um clique no cartão: não abrir o trabalho.
  const acabouDeArrastar = useRef(false)

  const porId = useMemo(() => new Map(trabalhos.map((t) => [t.id, t])), [trabalhos])
  const nomeLinha = useMemo(() => new Map(linhas.map((l) => [l.id ?? "", l.nome])), [linhas])

  function descreverDestino(destino: DestinoCelula | undefined) {
    if (!destino) return "fora da agenda"
    return `${nomeLinha.get(destino.equipaId ?? "") ?? ""}, ${formatarDiaCurto(destino.data)}`
  }

  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Pegou em ${porId.get(String(active.id))?.titulo ?? "trabalho"}.`,
    onDragOver: ({ over }) => `Sobre ${descreverDestino(over?.data.current as DestinoCelula | undefined)}.`,
    onDragEnd: ({ over }) => `Largou em ${descreverDestino(over?.data.current as DestinoCelula | undefined)}.`,
    onDragCancel: () => "Cancelado. O trabalho ficou onde estava.",
  }

  function aoComecar(evento: DragStartEvent) {
    acabouDeArrastar.current = true
    setAtivo(porId.get(String(evento.active.id)) ?? null)
  }

  function terminar() {
    setAtivo(null)
    setTimeout(() => {
      acabouDeArrastar.current = false
    }, 0)
  }

  function aoLargar(evento: DragEndEvent) {
    terminar()
    const trabalho = porId.get(String(evento.active.id))
    const destino = evento.over?.data.current as DestinoCelula | undefined
    if (!trabalho || !destino) return
    if (destino.data === trabalho.data && destino.equipaId === trabalho.equipaId) return
    mover(trabalho.id, destino.data, destino.equipaId)
  }

  return (
    <DndContext
      id="agenda-semana"
      sensors={sensores}
      collisionDetection={detetarColisao}
      onDragStart={aoComecar}
      onDragEnd={aoLargar}
      onDragCancel={terminar}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            "Para mudar o trabalho de dia ou de equipa, carregue em Espaço, use as setas para escolher a célula e carregue em Espaço para largar. Escape cancela.",
        },
      }}
    >
      <div
        className="overflow-x-auto rounded-xl border bg-card shadow-sm"
        onClickCapture={(evento) => {
          if (acabouDeArrastar.current) {
            evento.preventDefault()
            evento.stopPropagation()
          }
        }}
      >
        <div className="grid min-w-[52rem] grid-cols-7">
          <div className="contents">
            {dias.map((dia) => (
              <CabecalhoDia key={dia.data} dia={dia} href={hrefDia[dia.data]} />
            ))}
          </div>
          {linhas.map((linha) => (
            <Fragment key={linha.id ?? "sem-equipa"}>
              <FaixaEquipa linha={linha} />
              <div className="contents">
                {dias.map((dia) => (
                  <Celula
                    key={dia.data}
                    dia={dia}
                    linha={linha}
                    trabalhos={celulas.get(chaveCelula(linha.id, dia.data)) ?? []}
                    ausentes={linha.id ? ausentes[chaveCelula(linha.id, dia.data)] : undefined}
                    idAtivo={ativo?.id ?? null}
                  />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {ativo && (
          <div className="w-36 cursor-grabbing rounded-md border bg-card p-1.5 shadow-lg ring-2 ring-primary">
            <ConteudoCartaoCompacto trabalho={ativo} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function CabecalhoDia({ dia, href }: { dia: DiaAgenda; href?: string }) {
  return (
    <div
      className={cn(
        "border-b px-2 py-2 text-center [&:not(:first-child)]:border-l",
        dia.fimDeSemana && "bg-muted/50",
        dia.feriado && "bg-amber-50 dark:bg-amber-950/30"
      )}
    >
      <Link
        href={href ?? "#"}
        className="inline-flex flex-col items-center rounded-md px-2 py-0.5 hover:bg-accent"
        title={dia.feriado ? `Feriado: ${dia.feriado}` : "Ver o dia"}
      >
        <span className="text-xs text-muted-foreground capitalize">{formatarDiaSemanaCurto(dia.data)}</span>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
            dia.hoje && "bg-primary text-primary-foreground"
          )}
        >
          {Number(dia.data.slice(8, 10))}
        </span>
      </Link>
      {dia.feriado && (
        <span className="block truncate text-[11px] font-medium text-amber-800 dark:text-amber-300">
          {dia.feriado}
        </span>
      )}
    </div>
  )
}

function FaixaEquipa({ linha }: { linha: LinhaEquipa }) {
  const cor = linha.cor ?? "#78716c"
  return (
    <div
      className="col-span-7 flex items-center gap-2 border-y border-l-4 px-3 py-1.5 text-sm font-semibold"
      style={{ borderLeftColor: cor, backgroundColor: linha.id ? `${cor}14` : undefined }}
    >
      <span className="truncate">{linha.nome}</span>
      {!linha.editavel && (
        <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <LockIcon className="size-3" />
          Não chefia esta equipa: os trabalhos não são mostrados
        </span>
      )}
    </div>
  )
}

function Celula({
  dia,
  linha,
  trabalhos,
  ausentes,
  idAtivo,
}: {
  dia: DiaAgenda
  linha: LinhaEquipa
  trabalhos: TrabalhoAgenda[]
  ausentes?: Ausente[]
  idAtivo: string | null
}) {
  const destino: DestinoCelula = { data: dia.data, equipaId: linha.id }
  const { setNodeRef, isOver } = useDroppable({ id: chaveCelula(linha.id, dia.data), data: destino })

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`${linha.nome}, ${formatarDiaCurto(dia.data)}`}
      className={cn(
        "group relative flex min-h-24 flex-col gap-1 p-1 [&:not(:first-child)]:border-l",
        dia.fimDeSemana && "bg-muted/40",
        dia.feriado && "bg-amber-50/60 dark:bg-amber-950/20",
        dia.hoje && "bg-primary/5",
        !linha.editavel && "bg-muted/40",
        isOver && idAtivo && (linha.editavel ? "bg-accent ring-2 ring-primary ring-inset" : "ring-2 ring-destructive ring-inset")
      )}
    >
      {ausentes && ausentes.length > 0 && (
        <span
          className="flex items-start gap-1 text-[11px] leading-tight text-muted-foreground"
          title={ausentes.map((a) => `${a.nome} — ${a.motivo}`).join("\n")}
        >
          <UserRoundXIcon className="mt-px size-3 shrink-0" />
          <span className="line-clamp-2">{ausentes.map((a) => a.nome.split(" ")[0]).join(", ")}</span>
        </span>
      )}
      {trabalhos.map((trabalho) => (
        <CartaoArrastavel key={trabalho.id} trabalho={trabalho} arrastavel={linha.editavel && podeMover(trabalho)} />
      ))}
      {linha.editavel && (
        <Link
          href={urlNovoTrabalho(dia.data, linha.id)}
          aria-label={`Novo trabalho em ${formatarDiaCurto(dia.data)} (${linha.nome})`}
          className="mt-auto flex h-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent focus-visible:opacity-100"
        >
          <PlusIcon className="size-4" />
        </Link>
      )}
    </div>
  )
}

function CartaoArrastavel({ trabalho, arrastavel }: { trabalho: TrabalhoAgenda; arrastavel: boolean }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: trabalho.id,
    disabled: !arrastavel,
    attributes: { roleDescription: "trabalho arrastável" },
  })

  return (
    <Link
      ref={setNodeRef}
      href={`/trabalhos/${trabalho.id}`}
      {...(arrastavel ? listeners : {})}
      // Do dnd-kit só interessam a descrição e as instruções (o Link continua a ser uma ligação).
      aria-roledescription={arrastavel ? attributes["aria-roledescription"] : undefined}
      aria-describedby={arrastavel ? attributes["aria-describedby"] : undefined}
      data-trabalho={trabalho.id}
      className={cn(
        "block touch-manipulation rounded-md border bg-card p-1.5 shadow-xs transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
        arrastavel ? "cursor-grab" : "cursor-pointer",
        isDragging && "opacity-40"
      )}
    >
      <ConteudoCartaoCompacto trabalho={trabalho} />
    </Link>
  )
}

// ---------------------------------------------------------------------
// Telemóvel: lista por dia, agrupada por equipa (sem arrastar)
// ---------------------------------------------------------------------

function ListaSemana({
  dias,
  linhas,
  celulas,
  ausentes,
  hrefDia,
}: {
  dias: DiaAgenda[]
  linhas: LinhaEquipa[]
  celulas: Map<string, TrabalhoAgenda[]>
  ausentes: Ausentes
  hrefDia: Record<string, string>
}) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {dias.map((dia) => {
        const grupos = linhas
          .map((linha) => ({ linha, trabalhos: celulas.get(chaveCelula(linha.id, dia.data)) ?? [] }))
          .filter((grupo) => grupo.trabalhos.length > 0)
        const ausentesDia = linhas.flatMap((linha) => (linha.id ? (ausentes[chaveCelula(linha.id, dia.data)] ?? []) : []))
        return (
          <section key={dia.data} aria-label={formatarDiaCurto(dia.data)}>
            <h2 className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
              <Link href={hrefDia[dia.data] ?? "#"} className="font-semibold first-letter:uppercase">
                {formatarDiaCurto(dia.data)}
              </Link>
              {dia.hoje && <Badge>Hoje</Badge>}
              {dia.feriado && (
                <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300">
                  {dia.feriado}
                </Badge>
              )}
            </h2>
            {ausentesDia.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                <UserRoundXIcon className="mt-0.5 size-4 shrink-0" />
                <span>{ausentesDia.map((a) => `${a.nome.split(" ")[0]} (${a.motivo})`).join(", ")}</span>
              </p>
            )}
            {grupos.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarXIcon className="size-4" />
                Sem trabalhos.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4">
                {grupos.map(({ linha, trabalhos }) => (
                  <div key={linha.id ?? "sem-equipa"}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="inline-block size-2.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: linha.cor ?? "#78716c" }}
                      />
                      {linha.nome}
                    </h3>
                    <ul className="grid grid-cols-1 gap-2">
                      {trabalhos.map((trabalho) => (
                        <li key={trabalho.id}>
                          <Link
                            href={`/trabalhos/${trabalho.id}`}
                            className="flex min-h-16 rounded-xl border border-l-4 bg-card p-3 shadow-xs transition-colors active:bg-accent"
                            style={{ borderLeftColor: linha.cor ?? "#78716c" }}
                          >
                            <ConteudoCartaoGrande trabalho={trabalho} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
