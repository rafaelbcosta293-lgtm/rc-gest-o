import type { Enums } from "@/lib/supabase/database.types"
import { somarDiasData, somarMeses } from "@/lib/datas"

export type EstadoTrabalho = Enums<"estado_trabalho">
export type TipoTrabalho = Enums<"tipo_trabalho">
export type OrigemTrabalho = Enums<"origem_trabalho">
export type MomentoFoto = Enums<"momento_foto">

export const NOMES_ESTADO_TRABALHO: Record<EstadoTrabalho, string> = {
  agendado: "Agendado",
  em_curso: "Em curso",
  concluido: "Concluído",
  cancelado: "Cancelado",
}

/** Variante do Badge (components/ui/badge) para cada estado. */
export const VARIANTE_ESTADO_TRABALHO: Record<EstadoTrabalho, "secondary" | "default" | "outline" | "muted"> = {
  agendado: "secondary",
  em_curso: "default",
  concluido: "outline",
  cancelado: "muted",
}

export const NOMES_TIPO_TRABALHO: Record<TipoTrabalho, string> = {
  manutencao: "Manutenção",
  obra: "Obra",
}

export const NOMES_ORIGEM_TRABALHO: Record<OrigemTrabalho, string> = {
  avulso: "Pontual",
  contrato: "Contrato",
  orcamento: "Orçamento",
}

export const NOMES_MOMENTO_FOTO: Record<MomentoFoto, string> = {
  antes: "Antes",
  depois: "Depois",
  outra: "Outra",
}

export type Recorrencia = "nao" | "semanal" | "quinzenal" | "mensal"

export const NOMES_RECORRENCIA: Record<Recorrencia, string> = {
  nao: "Não se repete",
  semanal: "Todas as semanas",
  quinzenal: "De 15 em 15 dias",
  mensal: "Todos os meses",
}

/** Máximo de trabalhos criados de uma vez por uma repetição (cerca de um ano semanal). */
export const MAXIMO_REPETICOES = 53

/**
 * Datas de uma série a partir da primeira até "ate" (inclusive).
 * Mensal: o mesmo dia do mês, ou o último dia nos meses mais curtos.
 */
export function datasDaSerie(primeira: string, recorrencia: Recorrencia, ate: string): string[] {
  if (recorrencia === "nao") return [primeira]
  const datas: string[] = []
  for (let n = 0; datas.length < MAXIMO_REPETICOES; n++) {
    const data =
      recorrencia === "mensal"
        ? somarMeses(primeira, n)
        : somarDiasData(primeira, n * (recorrencia === "semanal" ? 7 : 14))
    if (data > ate) break
    datas.push(data)
  }
  return datas
}

/** Bucket do Storage com as fotos e assinaturas dos trabalhos (privado). */
export const BUCKET_FOTOS = "fotos"

/** Caminho no Storage: trabalhos/<trabalho_id>/<ficheiro> (a RLS do Storage depende deste formato). */
export function caminhoFicheiroTrabalho(trabalhoId: string, ficheiro: string) {
  return `trabalhos/${trabalhoId}/${ficheiro}`
}
