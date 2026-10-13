"use client"

import { useEffect } from "react"

/** Regista o service worker (public/sw.js) para a app poder ser instalada. */
export function RegistarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((erro) => console.error("Falha ao registar o service worker:", erro))
  }, [])

  return null
}
