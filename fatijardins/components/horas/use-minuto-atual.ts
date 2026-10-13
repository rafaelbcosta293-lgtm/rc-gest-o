"use client"

import { useSyncExternalStore } from "react"

const MINUTO = 60_000

function subscrever(aoMudar: () => void) {
  let temporizador: number
  // Acorda no início de cada minuto.
  const agendar = () => {
    temporizador = window.setTimeout(() => {
      aoMudar()
      agendar()
    }, MINUTO - (Date.now() % MINUTO) + 50)
  }
  agendar()
  // Ao voltar à app (ecrã bloqueado, outra aplicação), atualizar logo.
  document.addEventListener("visibilitychange", aoMudar)
  return () => {
    window.clearTimeout(temporizador)
    document.removeEventListener("visibilitychange", aoMudar)
  }
}

const minutoAtual = () => Math.floor(Date.now() / MINUTO) * MINUTO

/**
 * Hora atual arredondada ao minuto, atualizada a cada minuto.
 * No servidor (e na hidratação) usa a hora que o servidor enviou.
 */
export function useMinutoAtual(horaDoServidor: number): number {
  return useSyncExternalStore(subscrever, minutoAtual, () => Math.floor(horaDoServidor / MINUTO) * MINUTO)
}
