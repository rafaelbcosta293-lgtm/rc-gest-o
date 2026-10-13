import "server-only"

import { formatarHora, hojeEmLisboa } from "@/lib/formatar"
import { dataEmLisboa, instanteLisboa, minutosDoPeriodo } from "@/lib/horas"
import { createClient } from "@/lib/supabase/server"
import type { EstadoPicagem, PeriodoAberto, TrabalhoPicagem } from "./tipos"

type TrabalhoLido = {
  id: string
  titulo: string
  hora_inicio: string | null
  estado: TrabalhoPicagem["estado"]
  ordem: number
  equipa: { nome: string } | null
  cliente: { nome: string } | null
}

/** Ordena os trabalhos de hoje por equipa, ordem de passagem e hora. */
export function ordenarTrabalhosDoDia<T extends { ordem: number; hora_inicio: string | null; equipa: { nome: string } | null }>(
  trabalhos: T[]
): T[] {
  return [...trabalhos].sort(
    (a, b) =>
      // Trabalhos sem equipa no fim.
      Number(a.equipa === null) - Number(b.equipa === null) ||
      (a.equipa?.nome ?? "").localeCompare(b.equipa?.nome ?? "", "pt") ||
      a.ordem - b.ordem ||
      (a.hora_inicio ?? "99").localeCompare(b.hora_inicio ?? "99")
  )
}

/** Converte os trabalhos de hoje para a lista de escolha da picagem (sem os cancelados). */
function paraTrabalhosPicagem(trabalhos: TrabalhoLido[]): TrabalhoPicagem[] {
  return ordenarTrabalhosDoDia(trabalhos)
    .filter((trabalho) => trabalho.estado !== "cancelado")
    .map((trabalho) => ({
      id: trabalho.id,
      titulo: trabalho.titulo,
      cliente: trabalho.cliente?.nome ?? null,
      hora: trabalho.hora_inicio ? formatarHora(trabalho.hora_inicio) : null,
      equipa: trabalho.equipa?.nome ?? null,
      estado: trabalho.estado,
    }))
}

/**
 * Estado da picagem da pessoa: entrada em aberto, horas de hoje e os
 * trabalhos de hoje que pode escolher (a RLS devolve os da equipa; ao
 * chefe os das equipas que chefia; ao gerente todos).
 */
export async function carregarEstadoPicagem(colaboradorId: string): Promise<EstadoPicagem> {
  const supabase = await createClient()
  const agora = new Date()
  const hoje = hojeEmLisboa(agora)
  const inicioHoje = instanteLisboa(hoje, "00:00").toISOString()

  const [registosR, trabalhosR] = await Promise.all([
    supabase
      .from("registos_horas")
      .select("id, entrada, saida, trabalho_id, trabalho:trabalhos(titulo, cliente:clientes(nome))")
      .eq("colaborador_id", colaboradorId)
      .or(`saida.is.null,entrada.gte."${inicioHoje}"`)
      .order("entrada"),
    supabase
      .from("trabalhos")
      .select("id, titulo, hora_inicio, estado, ordem, equipa:equipas(nome), cliente:clientes(nome)")
      .eq("data", hoje)
      .neq("estado", "cancelado"),
  ])
  if (registosR.error) throw new Error(`Não foi possível carregar a picagem: ${registosR.error.message}`)
  if (trabalhosR.error) throw new Error(`Não foi possível carregar os trabalhos: ${trabalhosR.error.message}`)

  let aberto: PeriodoAberto | null = null
  let minutosFechadosHoje = 0
  let ultimaSaida: string | null = null
  for (const registo of registosR.data) {
    if (registo.saida === null) {
      aberto = {
        id: registo.id,
        entrada: registo.entrada,
        trabalhoId: registo.trabalho_id,
        trabalho: registo.trabalho?.titulo ?? null,
        cliente: registo.trabalho?.cliente?.nome ?? null,
      }
    } else if (dataEmLisboa(registo.entrada) === hoje) {
      minutosFechadosHoje += minutosDoPeriodo(registo, agora)
      ultimaSaida = formatarHora(registo.saida)
    }
  }

  return {
    aberto,
    hoje,
    agora: agora.getTime(),
    minutosFechadosHoje,
    ultimaSaida: aberto ? null : ultimaSaida,
    trabalhos: paraTrabalhosPicagem(trabalhosR.data),
  }
}
