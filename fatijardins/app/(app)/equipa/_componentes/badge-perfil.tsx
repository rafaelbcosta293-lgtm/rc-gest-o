import { Badge } from "@/components/ui/badge"
import { NOMES_PERFIL, type Perfil } from "@/lib/perfis"

const VARIANTES = {
  gerente: "default",
  chefe_equipa: "secondary",
  colaborador: "outline",
} as const satisfies Record<Perfil, "default" | "secondary" | "outline">

export function BadgePerfil({ perfil }: { perfil: Perfil }) {
  return <Badge variant={VARIANTES[perfil]}>{NOMES_PERFIL[perfil]}</Badge>
}
