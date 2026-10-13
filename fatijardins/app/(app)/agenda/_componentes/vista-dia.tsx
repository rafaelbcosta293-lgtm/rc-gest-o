"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarXIcon,
  GripVerticalIcon,
  PartyPopperIcon,
  PlusIcon,
  UserRoundXIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatarDuracao } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import { ConteudoCartaoGrande } from "./cartao-trabalho"
import {
  chaveCelula,
  compararTrabalhos,
  urlNovoTrabalho,
  type Ausente,
  type Ausentes,
  type DiaAgenda,
  type LinhaEquipa,
  type TrabalhoAgenda,
} from "./tipos"
import { useAgendaOtimista } from "./use-agenda-otimista"

type Props = {
  dia: DiaAgenda
  linhas: LinhaEquipa[]
  trabalhos: TrabalhoAgenda[]
  ausentes: Ausentes
}

/** Ao reordenar com o rato, o cartão só se mexe na vertical. */
const soVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function VistaDia({ dia, linhas, trabalhos, ausentes }: Props) {
  const { lista, reordenar } = useAgendaOtimista(trabalhos)

  return (
    <div className="grid grid-cols-1 gap-4">
      {dia.feriado && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <PartyPopperIcon className="size-5 shrink-0" />
          <span>
            <strong>Feriado nacional:</strong> {dia.feriado}.
          </span>
        </p>
      )}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] md:gap-4">
        {linhas.map((linha) => (
          <ColunaEquipa
            key={linha.id ?? "sem-equipa"}
            dia={dia}
            linha={linha}
            trabalhos={lista.filter((t) => t.equipaId === linha.id && t.data === dia.data).sort(compararTrabalhos)}
            ausentes={linha.id ? (ausentes[chaveCelula(linha.id, dia.data)] ?? []) : []}
            aoReordenar={(ids) => reordenar(dia.data, linha.id, ids)}
          />
        ))}
      </div>
    </div>
  )
}

function ColunaEquipa({
  dia,
  linha,
  trabalhos,
  ausentes,
  aoReordenar,
}: {
  dia: DiaAgenda
  linha: LinhaEquipa
  trabalhos: TrabalhoAgenda[]
  ausentes: Ausente[]
  aoReordenar: (ids: string[]) => void
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids = useMemo(() => trabalhos.map((t) => t.id), [trabalhos])
  const titulos = useMemo(() => new Map(trabalhos.map((t) => [t.id, t.titulo])), [trabalhos])
  const minutos = trabalhos
    .filter((t) => t.estado !== "cancelado")
    .reduce((total, t) => total + (t.duracaoMin ?? 0), 0)
  const cor = linha.cor ?? "#78716c"
  const idTitulo = `equipa-${linha.id ?? "sem-equipa"}`

  function mudar(de: number, para: number) {
    if (para < 0 || para >= ids.length || de === para) return
    aoReordenar(arrayMove(ids, de, para))
  }

  function aoLargar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    mudar(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }

  const posicao = (id: unknown) => ids.indexOf(String(id)) + 1
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Pegou em ${titulos.get(String(active.id))}, ${posicao(active.id)}.º.`,
    onDragOver: ({ over }) => (over ? `Posição ${posicao(over.id)} de ${ids.length}.` : undefined),
    onDragEnd: ({ over }) => (over ? `Largou na posição ${posicao(over.id)}.` : "Largou fora da lista."),
    onDragCancel: () => "Cancelado. A ordem não mudou.",
  }

  return (
    <section aria-labelledby={idTitulo} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
      <header
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-l-4 px-4 py-3"
        style={{ borderLeftColor: cor, backgroundColor: linha.id ? `${cor}14` : undefined }}
      >
        <h2 id={idTitulo} className="font-semibold">
          {linha.nome}
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {trabalhos.length === 1 ? "1 trabalho" : `${trabalhos.length} trabalhos`}
          {minutos > 0 && ` · ${formatarDuracao(minutos)} previstas`}
        </p>
      </header>

      {ausentes.length > 0 && (
        <ul className="grid gap-1 border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          {ausentes.map((ausente, i) => (
            <li key={`${ausente.nome}-${i}`} className="flex items-center gap-2">
              <UserRoundXIcon className="size-4 shrink-0" />
              <span>
                {ausente.nome} — {ausente.motivo}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="p-3">
        {trabalhos.length === 0 ? (
          <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
            <CalendarXIcon className="size-4" />
            Sem trabalhos neste dia.
          </p>
        ) : (
          <DndContext
            id={`agenda-dia-${linha.id ?? "sem-equipa"}`}
            sensors={sensores}
            collisionDetection={closestCenter}
            modifiers={[soVertical]}
            onDragEnd={aoLargar}
            accessibility={{
              announcements: anuncios,
              screenReaderInstructions: {
                draggable:
                  "Para mudar a ordem, carregue em Espaço, use as setas para cima e para baixo e carregue em Espaço para largar. Escape cancela.",
              },
            }}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="grid grid-cols-1 gap-2">
                {trabalhos.map((trabalho, i) => (
                  <ItemOrdenavel
                    key={trabalho.id}
                    trabalho={trabalho}
                    posicao={i + 1}
                    total={trabalhos.length}
                    editavel={linha.editavel}
                    cor={cor}
                    aoSubir={() => mudar(i, i - 1)}
                    aoDescer={() => mudar(i, i + 1)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        {linha.editavel && (
          <Button asChild variant="ghost" size="lg" className="mt-2 w-full text-muted-foreground">
            <Link href={urlNovoTrabalho(dia.data, linha.id)}>
              <PlusIcon />
              Adicionar trabalho
            </Link>
          </Button>
        )}
      </div>
    </section>
  )
}

function ItemOrdenavel({
  trabalho,
  posicao,
  total,
  editavel,
  cor,
  aoSubir,
  aoDescer,
}: {
  trabalho: TrabalhoAgenda
  posicao: number
  total: number
  editavel: boolean
  cor: string
  aoSubir: () => void
  aoDescer: () => void
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({
    id: trabalho.id,
    disabled: !editavel,
    attributes: { roleDescription: "trabalho reordenável" },
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, borderLeftColor: cor }}
      className={cn(
        "flex items-stretch gap-1 rounded-xl border border-l-4 bg-card shadow-xs",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary"
      )}
    >
      {editavel && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastar para mudar a ordem de ${trabalho.titulo}`}
          className="hidden w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-lg text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
        >
          <GripVerticalIcon className="size-4" />
        </button>
      )}
      <Link
        href={`/trabalhos/${trabalho.id}`}
        className={cn(
          "flex min-h-16 min-w-0 flex-1 rounded-xl p-3 transition-colors hover:bg-accent/50 active:bg-accent",
          editavel && "md:pl-1"
        )}
      >
        <ConteudoCartaoGrande trabalho={trabalho} posicao={posicao} />
      </Link>
      {editavel && (
        // No telemóvel não se arrasta: botões grandes para subir e descer na ordem.
        <div className="flex shrink-0 flex-col border-l md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="flex-1 rounded-none rounded-tr-xl"
            onClick={aoSubir}
            disabled={posicao === 1}
            aria-label={`Passar ${trabalho.titulo} para antes`}
          >
            <ArrowUpIcon className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="flex-1 rounded-none rounded-br-xl border-t"
            onClick={aoDescer}
            disabled={posicao === total}
            aria-label={`Passar ${trabalho.titulo} para depois`}
          >
            <ArrowDownIcon className="size-5" />
          </Button>
        </div>
      )}
    </li>
  )
}
