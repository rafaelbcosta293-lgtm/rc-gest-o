"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import type { ResultadoAcao } from "@/lib/acoes"
import { lugarNaOrdem } from "@/lib/trabalhos"
import { moverTrabalho, reordenarTrabalhos } from "../../trabalhos/acoes"
import type { TrabalhoAgenda } from "./tipos"

type Alteracao =
  | { tipo: "mover"; id: string; data: string; equipaId: string | null }
  | { tipo: "reordenar"; ids: string[] }

function aplicar(trabalhos: TrabalhoAgenda[], alteracao: Alteracao): TrabalhoAgenda[] {
  if (alteracao.tipo === "mover") {
    // Entra na ordem do novo dia/equipa segundo a hora (como no servidor).
    const movido = trabalhos.find((t) => t.id === alteracao.id)
    if (!movido) return trabalhos
    const destino = trabalhos.filter(
      (t) => t.id !== alteracao.id && t.data === alteracao.data && t.equipaId === alteracao.equipaId
    )
    const { ordem, empurrados } = lugarNaOrdem(destino, movido.hora)
    const novas = new Map(empurrados.map((t) => [t.id, t.ordem]))
    return trabalhos.map((t) => {
      if (t.id === alteracao.id) return { ...t, data: alteracao.data, equipaId: alteracao.equipaId, ordem }
      const nova = novas.get(t.id)
      return nova === undefined ? t : { ...t, ordem: nova }
    })
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
 * Se o servidor recusar (ex.: mudar o dia de um trabalho com horas), a
 * ação não revalida nada e, no fim da transição, a agenda volta ao que
 * estava e aparece o erro.
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
