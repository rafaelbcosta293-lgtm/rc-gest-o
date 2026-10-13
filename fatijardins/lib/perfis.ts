import type { Enums } from "@/lib/supabase/database.types"

export type Perfil = Enums<"perfil_utilizador">

export const NOMES_PERFIL: Record<Perfil, string> = {
  gerente: "Gerente",
  chefe_equipa: "Chefe de equipa",
  colaborador: "Colaborador",
}

export const PERFIS: Perfil[] = ["gerente", "chefe_equipa", "colaborador"]

export function eGerente(perfil: Perfil | null | undefined) {
  return perfil === "gerente"
}

export function eGerenteOuChefe(perfil: Perfil | null | undefined) {
  return perfil === "gerente" || perfil === "chefe_equipa"
}
