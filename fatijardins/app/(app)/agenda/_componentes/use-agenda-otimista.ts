"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import type { ResultadoAcao } from "@/lib/acoes"
import { moverTrabalho, reordenarTrabalhos } from "../../trabalhos/acoes"
import type { TrabalhoAgenda } from "./tipos"

type Alteracao =
  | { tipo: "mover"; id: string; data: string; equipaId: string | null }
  | { tipo: "reordenar"; ids: string[] }

function aplicar(trabalhos: TrabalhoAgenda[], alteracao: Alteracao): TrabalhoAgenda[] {
  if (alteracao.tipo === "mover") {
    // Fica no fim da ordem do novo dia/equipa (como no servidor).
    const ultima = trabalhos
      .filter((t) => t.id !== alteracao.id && t.data === alteracao.data && t.equipaId === alteracao.equipaId)
      .reduce((maximo, t) => Math.max(maximo, t.ordem), 0)
    return trabalhos.map((t) =>
      t.id === alteracao.id ? { ...t, data: alteracao.data, equipaId: alteracao.equipaId, ordem: ultima + 1 } : t
    )
  }
  const posicoes = new Map(alteracao.ids.map((id, i) => [id, i + 1]))
  return trabalhos.map((t) => {
    const ordem = posicoes.get(t.id)
    return ordem === undefined ? t : { ...t, ordem }
  })
}

async function executar(acao: () => Promise<ResultadoAcao>): Promise<ResultadoAcao | null> {
  try {
    const resultado = await acao()
    if (!resultado.ok) toast.error(resultado.erro)
    return resultado
  } catch {
    toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
    return null
  }
}

/**
 * Mostra logo a alteração (arrastar ou ↑/↓) enquanto o servidor grava.
 * Se o servidor recusar, a agenda volta ao que estava e aparece o erro.
 */
export function useAgendaOtimista(trabalhos: TrabalhoAgenda[]) {
  const [lista, aplicarOtimista] = useOptimistic(trabalhos, aplicar)
  const [aGuardar, iniciar] = useTransition()

  function mover(id: string, data: string, equipaId: string | null) {
    iniciar(async () => {
      aplicarOtimista({ tipo: "mover", id, data, equipaId })
      const resultado = await executar(() => moverTrabalho(id, data, equipaId))
      if (resultado?.ok && resultado.mensagem) toast.success(resultado.mensagem)
    })
  }

  function reordenar(data: string, equipaId: string | null, ids: string[]) {
    iniciar(async () => {
      aplicarOtimista({ tipo: "reordenar", ids })
      await executar(() => reordenarTrabalhos(data, equipaId, ids))
    })
  }

  return { lista, mover, reordenar, aGuardar }
}
