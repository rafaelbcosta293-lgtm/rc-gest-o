import { Badge } from "@/components/ui/badge"
import {
  descreverAtraso,
  NOMES_ESTADO_COBRANCA,
  VARIANTE_ESTADO_COBRANCA,
  type EstadoCobranca,
} from "@/lib/financas"

/** Estado da cobrança e, quando está em atraso, há quantos dias venceu. */
export function BadgeEstadoCobranca({ estado, diasAtraso }: { estado: EstadoCobranca; diasAtraso: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant={VARIANTE_ESTADO_COBRANCA[estado]}>{NOMES_ESTADO_COBRANCA[estado]}</Badge>
      {estado === "atrasada" && diasAtraso > 0 && (
        <span className="text-xs font-medium whitespace-nowrap text-destructive">{descreverAtraso(diasAtraso)}</span>
      )}
    </span>
  )
}
