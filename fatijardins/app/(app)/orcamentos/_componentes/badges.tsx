import { Badge } from "@/components/ui/badge"
import { NOMES_ESTADO_ORCAMENTO, VARIANTE_ESTADO_ORCAMENTO, type EstadoOrcamento } from "@/lib/orcamentos"

export function BadgeEstadoOrcamento({ estado }: { estado: EstadoOrcamento }) {
  return <Badge variant={VARIANTE_ESTADO_ORCAMENTO[estado]}>{NOMES_ESTADO_ORCAMENTO[estado]}</Badge>
}

/** Enviado e com a validade ultrapassada (ver estaExpirado). */
export function BadgeExpirado() {
  return (
    <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300">
      Expirado
    </Badge>
  )
}
