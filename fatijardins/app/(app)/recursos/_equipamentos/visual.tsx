import {
  CalendarClockIcon,
  CogIcon,
  HammerIcon,
  PackageIcon,
  TriangleAlertIcon,
  TruckIcon,
  UserRoundIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react"

import { PontoCor } from "@/app/(app)/equipa/_componentes/ponto-cor"
import { Badge } from "@/components/ui/badge"
import {
  descreverAlerta,
  NOMES_ESTADO_EQUIPAMENTO,
  NOMES_TIPO_EQUIPAMENTO,
  VARIANTE_ESTADO_EQUIPAMENTO,
  type AlertaPrazo,
  type EstadoEquipamento,
  type TipoEquipamento,
} from "@/lib/recursos"
import { cn } from "@/lib/utils"

export const ICONE_TIPO_EQUIPAMENTO: Record<TipoEquipamento, LucideIcon> = {
  viatura: TruckIcon,
  maquina: CogIcon,
  ferramenta: HammerIcon,
  outro: PackageIcon,
}

/** Círculo com o ícone do tipo (decorativo: o nome do tipo aparece sempre ao lado). */
export function IconeTipoEquipamento({ tipo, className }: { tipo: TipoEquipamento; className?: string }) {
  const Icone = ICONE_TIPO_EQUIPAMENTO[tipo]
  return (
    <span
      aria-hidden="true"
      title={NOMES_TIPO_EQUIPAMENTO[tipo]}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground",
        className
      )}
    >
      <Icone className="size-5" />
    </span>
  )
}

export function BadgeEstadoEquipamento({ estado }: { estado: EstadoEquipamento }) {
  return <Badge variant={VARIANTE_ESTADO_EQUIPAMENTO[estado]}>{NOMES_ESTADO_EQUIPAMENTO[estado]}</Badge>
}

/** Cores dos alertas: vermelho se já venceu, âmbar se vence nos próximos 30 dias. */
export const COR_ALERTA = {
  vencido: "border-destructive/30 bg-destructive/10 text-destructive",
  aVencer: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
}

/** Alerta de um prazo (revisão, seguro, IPO) em forma de etiqueta. */
export function EtiquetaAlerta({ alerta }: { alerta: AlertaPrazo }) {
  const Icone = alerta.vencido ? TriangleAlertIcon : CalendarClockIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        alerta.vencido ? COR_ALERTA.vencido : COR_ALERTA.aVencer
      )}
    >
      <Icone className="size-3.5 shrink-0" aria-hidden="true" />
      {descreverAlerta(alerta)}
    </span>
  )
}

/** Matrícula com aspeto de chapa (AA-12-BC). */
export function Matricula({ matricula, className }: { matricula: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-foreground/25 bg-background px-1.5 font-mono text-xs font-semibold tracking-wider whitespace-nowrap text-foreground",
        className
      )}
    >
      <span className="sr-only">Matrícula </span>
      {matricula}
    </span>
  )
}

/** Equipa e/ou pessoa a quem está atribuído; sem nenhuma, está no armazém. */
export function Atribuicao({
  equipa,
  pessoa,
  className,
}: {
  equipa: { nome: string; cor: string } | null
  pessoa: { nome: string } | null
  className?: string
}) {
  if (!equipa && !pessoa) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
        <WarehouseIcon className="size-4 shrink-0" aria-hidden="true" />
        Armazém
      </span>
    )
  }
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {equipa && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <PontoCor cor={equipa.cor} />
          <span className="break-words">{equipa.nome}</span>
        </span>
      )}
      {pessoa && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <UserRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="break-words">{pessoa.nome}</span>
        </span>
      )}
    </span>
  )
}
