"use client"

import { useState } from "react"

/** Os URLs valem 1 hora: o mesmo URL é reutilizado durante 30 minutos. */
const REUTILIZAR_URL_MS = 30 * 60 * 1000

type UrlGuardado = { url: string | null; geradoEm: number }
type FotoComUrl = { id: string; url: string | null }

/**
 * Cada atualização da página (depois de qualquer ação) traz URLs assinados
 * novos para as mesmas fotos; mantendo o URL anterior enquanto é válido, o
 * browser usa a cópia em cache e não volta a descarregar as fotos.
 */
function juntarUrls(
  anteriores: Record<string, UrlGuardado>,
  fotos: FotoComUrl[],
  geradoEm: number
): Record<string, UrlGuardado> {
  const resultado: Record<string, UrlGuardado> = {}
  for (const foto of fotos) {
    const anterior = anteriores[foto.id]
    resultado[foto.id] =
      anterior?.url && geradoEm - anterior.geradoEm < REUTILIZAR_URL_MS ? anterior : { url: foto.url, geradoEm }
  }
  return resultado
}

/** As fotos vindas do servidor, com o URL de cada uma estável enquanto é válido. */
export function useUrlsFotos<F extends FotoComUrl>(fotosServidor: F[], urlsGeradosEm: number): F[] {
  const [urls, setUrls] = useState(() => juntarUrls({}, fotosServidor, urlsGeradosEm))
  const [fotosAnteriores, setFotosAnteriores] = useState(fotosServidor)
  if (fotosAnteriores !== fotosServidor) {
    setFotosAnteriores(fotosServidor)
    setUrls(juntarUrls(urls, fotosServidor, urlsGeradosEm))
  }
  return fotosServidor.map((foto) => ({ ...foto, url: urls[foto.id]?.url ?? foto.url }))
}
