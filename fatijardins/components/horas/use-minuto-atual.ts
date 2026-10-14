"use client"

import { useCallback, useSyncExternalStore } from "react"

const MINUTO = 60_000

const aoMinuto = (instante: number) => Math.floor(instante / MINUTO) * MINUTO

/**
 * Diferença (ms) entre o relógio do servidor e o do telemóvel, medida da
 * primeira vez que se vê cada hora do servidor (logo depois de a página
 * chegar). Fica guardada para não mudar se a página voltar a montar.
 */
const diferencas = new Map<number, number>()

function diferencaDoRelogio(horaDoServidor: number): number {
  let diferenca = diferencas.get(horaDoServidor)
  if (diferenca === undefined) {
    diferenca = horaDoServidor - Date.now()
    // Só as medições recentes interessam.
    const maisAntiga = diferencas.size >= 20 ? diferencas.keys().next().value : undefined
    if (maisAntiga !== undefined) diferencas.delete(maisAntiga)
    diferencas.set(horaDoServidor, diferenca)
  }
  return diferenca
}

function subscreverMinutos(diferenca: number, aoMudar: () => void) {
  let temporizador: number
  // Acorda no início de cada minuto (do relógio do servidor).
  const agendar = () => {
    temporizador = window.setTimeout(() => {
      aoMudar()
      agendar()
    }, MINUTO - ((Date.now() + diferenca) % MINUTO) + 50)
  }
  agendar()
  // Ao voltar à app (ecrã bloqueado, outra aplicação), atualizar logo.
  document.addEventListener("visibilitychange", aoMudar)
  return () => {
    window.clearTimeout(temporizador)
    document.removeEventListener("visibilitychange", aoMudar)
  }
}

/**
 * Hora atual arredondada ao minuto, atualizada a cada minuto.
 * No servidor (e na hidratação) usa a hora que o servidor enviou; depois
 * conta a partir dela, para um telemóvel com o relógio adiantado ou
 * atrasado não mostrar o tempo errado.
 */
export function useMinutoAtual(horaDoServidor: number): number {
  const subscrever = useCallback(
    (aoMudar: () => void) => subscreverMinutos(diferencaDoRelogio(horaDoServidor), aoMudar),
    [horaDoServidor]
  )
  const minutoAtual = useCallback(() => aoMinuto(Date.now() + diferencaDoRelogio(horaDoServidor)), [horaDoServidor])
  return useSyncExternalStore(subscrever, minutoAtual, () => aoMinuto(horaDoServidor))
}
