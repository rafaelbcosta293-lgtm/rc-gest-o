import type { Enums } from "@/lib/supabase/database.types"

export type TipoAusencia = Enums<"tipo_ausencia">

export const NOMES_TIPO_AUSENCIA: Record<TipoAusencia, string> = {
  ferias: "Férias",
  doenca: "Doença",
  formacao: "Formação",
  falta: "Falta",
  outro: "Outro",
}

export const TIPOS_AUSENCIA: TipoAusencia[] = ["ferias", "doenca", "formacao", "falta", "outro"]
