import type { Enums } from "@/lib/supabase/database.types"
import { somarDiasData, somarMeses } from "@/lib/datas"
import type { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

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

/** Trabalho na ordem de passagem de um dia de uma equipa (hora "08:30" ou null). */
export type ItemOrdem = { id: string; ordem: number; hora: string | null; titulo: string }

/** Ordem de passagem; depois a hora (sem hora no fim) e o título. */
export function compararOrdem(a: ItemOrdem, b: ItemOrdem) {
  if (a.ordem !== b.ordem) return a.ordem - b.ordem
  if (a.hora !== b.hora) {
    if (a.hora === null) return 1
    if (b.hora === null) return -1
    return a.hora < b.hora ? -1 : 1
  }
  return a.titulo.localeCompare(b.titulo, "pt")
}

/**
 * Lugar de um trabalho que entra num dia de uma equipa (novo, ou vindo de
 * outro dia/equipa): antes do primeiro com hora posterior (os sem hora não
 * contam) ou, se não houver, logo a seguir ao último com hora; sem hora, ou
 * num dia só com trabalhos sem hora, fica no fim. Os seguintes são empurrados
 * uma posição; a ordem dos outros entre si (que pode ter sido mudada à mão)
 * mantém-se.
 */
export function lugarNaOrdem(
  trabalhos: ItemOrdem[],
  hora: string | null
): { ordem: number; empurrados: { id: string; ordem: number }[] } {
  const lista = [...trabalhos].sort(compararOrdem)
  const nova = hora?.slice(0, 5) ?? null
  // Antes do primeiro com hora posterior; os sem hora não contam (podem ter sido postos à mão
  // em qualquer lugar). Sem nenhum posterior, logo a seguir ao último com hora. Sem hora: no fim.
  let i = -1
  if (nova !== null) {
    i = lista.findIndex((t) => t.hora !== null && t.hora.slice(0, 5) > nova)
    if (i === -1) {
      const ultimoComHora = lista.findLastIndex((t) => t.hora !== null)
      i = ultimoComHora === -1 ? lista.length : ultimoComHora + 1
    }
  }
  if (i === -1) i = lista.length

  const ordem = i === 0 ? Math.min(1, lista[0]?.ordem ?? 1) : lista[i - 1].ordem + 1
  const empurrados: { id: string; ordem: number }[] = []
  let anterior = ordem
  for (const trabalho of lista.slice(i)) {
    const seguinte = Math.max(trabalho.ordem, anterior + 1)
    if (seguinte !== trabalho.ordem) empurrados.push({ id: trabalho.id, ordem: seguinte })
    anterior = seguinte
  }
  return { ordem, empurrados }
}

/**
 * Lugar na ordem de passagem (ver lugarNaOrdem) de um trabalho que entra em
 * cada dia de uma equipa (ou de "por atribuir"), com a hora de início que
 * terá nesse dia. Devolve null se a leitura falhar. Usado ao criar, mover e
 * converter um orçamento em trabalho (só no servidor).
 */
export async function lugaresNaOrdem(
  supabase: Supabase,
  equipaId: string | null,
  entradas: { data: string; hora: string | null }[],
  excluir: string[] = []
): Promise<Map<string, ReturnType<typeof lugarNaOrdem>> | null> {
  let consulta = supabase
    .from("trabalhos")
    .select("id, data, ordem, hora_inicio, titulo")
    .in("data", entradas.map((e) => e.data))
  consulta = equipaId ? consulta.eq("equipa_id", equipaId) : consulta.is("equipa_id", null)
  const { data, error } = await consulta
  if (error) {
    console.error("Erro da base de dados:", error.code, error.message)
    return null
  }
  const outros = data.filter((t) => !excluir.includes(t.id))
  return new Map(
    entradas.map(({ data: dia, hora }) => [
      dia,
      lugarNaOrdem(
        outros
          .filter((t) => t.data === dia)
          .map((t) => ({ id: t.id, ordem: t.ordem, hora: t.hora_inicio, titulo: t.titulo })),
        hora
      ),
    ])
  )
}

/** Grava ordens de passagem (os trabalhos empurrados); não é crítico se falhar (desempata a hora). */
export async function gravarOrdens(supabase: Supabase, ordens: { id: string; ordem: number }[]) {
  const resultados = await Promise.all(
    ordens.map((t) => supabase.from("trabalhos").update({ ordem: t.ordem }).eq("id", t.id))
  )
  for (const { error } of resultados) {
    if (error) console.error("Erro da base de dados:", error.code, error.message)
  }
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
