import { ClockIcon, HammerIcon, MapPinIcon, RepeatIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatarDuracao, formatarHora } from "@/lib/formatar"
import { NOMES_ESTADO_TRABALHO, VARIANTE_ESTADO_TRABALHO } from "@/lib/trabalhos"
import { cn } from "@/lib/utils"
import type { TrabalhoAgenda } from "./tipos"

function BadgeEstado({ trabalho, className }: { trabalho: TrabalhoAgenda; className?: string }) {
  return (
    <Badge variant={VARIANTE_ESTADO_TRABALHO[trabalho.estado]} className={className}>
      {NOMES_ESTADO_TRABALHO[trabalho.estado]}
    </Badge>
  )
}

/** Conteúdo do cartão pequeno da grelha semanal (PC). */
export function ConteudoCartaoCompacto({ trabalho }: { trabalho: TrabalhoAgenda }) {
  const cancelado = trabalho.estado === "cancelado"
  return (
    <span className={cn("flex min-w-0 flex-col gap-0.5", cancelado && "opacity-60")}>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
        {trabalho.hora ? formatarHora(trabalho.hora) : "Sem hora"}
        {trabalho.serie && <RepeatIcon className="size-3" aria-label="Repete-se" />}
        {trabalho.tipo === "obra" && <HammerIcon className="size-3" aria-label="Obra" />}
      </span>
      <span className={cn("line-clamp-2 text-xs leading-snug font-medium", cancelado && "line-through")}>
        {trabalho.titulo}
      </span>
      <span className="truncate text-[11px] text-muted-foreground">
        {trabalho.cliente} — {trabalho.local}
      </span>
      <BadgeEstado trabalho={trabalho} className="mt-0.5 px-1.5 py-0 text-[10px]" />
    </span>
  )
}

/** Conteúdo do cartão grande (telemóvel e vista do dia). */
export function ConteudoCartaoGrande({
  trabalho,
  posicao,
}: {
  trabalho: TrabalhoAgenda
  /** Número na ordem de passagem (vista do dia). */
  posicao?: number
}) {
  const cancelado = trabalho.estado === "cancelado"
  return (
    <span className={cn("flex min-w-0 flex-1 items-start gap-3", cancelado && "opacity-60")}>
      {posicao !== undefined && (
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground tabular-nums"
          aria-label={`${posicao}.º`}
        >
          {posicao}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("font-medium text-pretty", cancelado && "line-through")}>{trabalho.titulo}</span>
          <BadgeEstado trabalho={trabalho} />
        </span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPinIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            {trabalho.cliente} — {trabalho.local}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3.5" />
            {trabalho.hora ? formatarHora(trabalho.hora) : "Sem hora"}
            {trabalho.duracaoMin ? ` · ${formatarDuracao(trabalho.duracaoMin)}` : ""}
          </span>
          {trabalho.tipo === "obra" && (
            <span className="inline-flex items-center gap-1">
              <HammerIcon className="size-3.5" />
              Obra
            </span>
          )}
          {trabalho.serie && (
            <span className="inline-flex items-center gap-1">
              <RepeatIcon className="size-3.5" />
              Repete-se
            </span>
          )}
        </span>
      </span>
    </span>
  )
}
