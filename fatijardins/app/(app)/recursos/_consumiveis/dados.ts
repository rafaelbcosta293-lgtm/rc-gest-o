import "server-only"

import { somarDias } from "@/lib/formatar"
import type { createClient } from "@/lib/supabase/server"
import type { OpcaoTrabalho } from "./tipos"

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Movimentos mostrados de cada vez na ficha do consumível ("Ver mais" mostra os seguintes). */
export const MOVIMENTOS_POR_PAGINA = 50

/** "Cliente — Local" de um trabalho. */
export function descreverTrabalho(trabalho: {
  titulo: string
  cliente: { nome: string } | null
  local: { nome: string } | null
}): string {
  const partes = [trabalho.cliente?.nome, trabalho.local?.nome].filter(Boolean)
  return partes.length > 0 ? partes.join(" — ") : trabalho.titulo
}

/** Categorias já usadas (sugestões do campo Categoria), por ordem alfabética. */
export async function carregarCategorias(supabase: Supabase): Promise<string[]> {
  const { data, error } = await supabase.from("consumiveis").select("categoria").not("categoria", "is", null)
  if (error) throw new Error(`Erro ao carregar as categorias: ${error.message}`)
  const categorias = new Set(
    data.map((linha) => linha.categoria?.trim()).filter((categoria): categoria is string => !!categoria)
  )
  return [...categorias].sort((a, b) => a.localeCompare(b, "pt"))
}

/**
 * Trabalhos a que se pode ligar uma saída: dos últimos 30 dias e dos
 * próximos 7 (sem os cancelados), dos mais recentes para os mais antigos.
 */
export async function carregarTrabalhosRecentes(supabase: Supabase, hoje: string): Promise<OpcaoTrabalho[]> {
  const { data, error } = await supabase
    .from("trabalhos")
    .select("id, data, titulo, cliente:clientes(nome), local:locais(nome)")
    .gte("data", somarDias(hoje, -30))
    .lte("data", somarDias(hoje, 7))
    .neq("estado", "cancelado")
    .order("data", { ascending: false })
    .order("ordem")
  if (error) throw new Error(`Erro ao carregar os trabalhos: ${error.message}`)
  return data.map((trabalho) => ({ id: trabalho.id, data: trabalho.data, descricao: descreverTrabalho(trabalho) }))
}
