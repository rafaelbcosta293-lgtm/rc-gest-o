"use client"

import { useSyncExternalStore } from "react"
import { WifiOffIcon } from "lucide-react"

function subscreverRede(aviso: () => void) {
  window.addEventListener("online", aviso)
  window.addEventListener("offline", aviso)
  return () => {
    window.removeEventListener("online", aviso)
    window.removeEventListener("offline", aviso)
  }
}

/** true quando o browser está sem rede. */
export function useSemRede() {
  return useSyncExternalStore(subscreverRede, () => !navigator.onLine, () => false)
}

/** Aviso mostrado por cima dos botões das fotos quando não há rede. */
export function AvisoSemRede() {
  const offline = useSemRede()
  if (!offline) return null
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <WifiOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      Sem rede. Pode tirar as fotos, mas só são enviadas quando houver ligação (use “Tentar de novo”).
    </p>
  )
}
