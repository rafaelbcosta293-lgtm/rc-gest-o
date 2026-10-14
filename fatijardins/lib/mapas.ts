/**
 * Ligações para abrir um destino no Google Maps ou no Waze (no telemóvel
 * abrem a aplicação, se estiver instalada). Se houver coordenadas usa-as,
 * porque são mais exatas; senão usa a morada.
 */
export type DestinoMapa = {
  latitude?: number | null
  longitude?: number | null
  /** Morada em texto (ex.: o resultado de moradaCompleta). */
  morada?: string | null
}

function temCoordenadas(
  destino: DestinoMapa
): destino is DestinoMapa & { latitude: number; longitude: number } {
  return (
    typeof destino.latitude === "number" &&
    typeof destino.longitude === "number" &&
    Number.isFinite(destino.latitude) &&
    Number.isFinite(destino.longitude)
  )
}

/** Junta morada, código postal e localidade numa linha ("Rua X, 1000-001 Lisboa"). */
export function moradaCompleta({
  morada,
  codigoPostal,
  localidade,
}: {
  morada?: string | null
  codigoPostal?: string | null
  localidade?: string | null
}): string {
  const cpLocalidade = [codigoPostal, localidade].filter(Boolean).join(" ")
  return [morada, cpLocalidade].filter(Boolean).join(", ")
}

/** Navegação no Google Maps até ao destino. Devolve null se não houver coordenadas nem morada. */
export function urlGoogleMaps(destino: DestinoMapa): string | null {
  const parametros = new URLSearchParams({ api: "1" })
  if (temCoordenadas(destino)) {
    parametros.set("destination", `${destino.latitude},${destino.longitude}`)
  } else if (destino.morada?.trim()) {
    parametros.set("destination", destino.morada.trim())
  } else {
    return null
  }
  return `https://www.google.com/maps/dir/?${parametros.toString()}`
}

/** Navegação no Waze até ao destino. Devolve null se não houver coordenadas nem morada. */
export function urlWaze(destino: DestinoMapa): string | null {
  const parametros = new URLSearchParams()
  if (temCoordenadas(destino)) {
    parametros.set("ll", `${destino.latitude},${destino.longitude}`)
  } else if (destino.morada?.trim()) {
    parametros.set("q", destino.morada.trim())
  } else {
    return null
  }
  parametros.set("navigate", "yes")
  return `https://waze.com/ul?${parametros.toString()}`
}

/** Ponto no OpenStreetMap (ex.: onde a pessoa picou). Devolve null se não houver coordenadas. */
export function urlOpenStreetMap(destino: DestinoMapa): string | null {
  if (!temCoordenadas(destino)) return null
  const { latitude, longitude } = destino
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
}

/** Coordenadas em texto ("38.7006, -9.4219"), ou "" se não houver. */
export function textoCoordenadas(destino: DestinoMapa | null | undefined): string {
  return destino && temCoordenadas(destino) ? `${destino.latitude}, ${destino.longitude}` : ""
}
