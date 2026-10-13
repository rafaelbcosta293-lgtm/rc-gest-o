import Link from "next/link"
import { MapPinIcon, NavigationIcon, PhoneIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatarArea } from "@/lib/formatar"
import { moradaCompleta, urlGoogleMaps, urlWaze } from "@/lib/mapas"

export type LocalTrabalho = {
  nome: string
  morada: string
  codigo_postal: string | null
  localidade: string | null
  latitude: number | null
  longitude: number | null
  area_m2: number | null
  notas: string | null
}

export type ClienteTrabalho = {
  id: string
  nome: string
  pessoa_contacto: string | null
  telemovel: string | null
  telefone: string | null
}

/** Número só com algarismos e "+", para a ligação tel:. */
function numeroParaLigacao(numero: string) {
  return numero.replace(/[^\d+]/g, "")
}

type Props = {
  local: LocalTrabalho | null
  cliente: ClienteTrabalho | null
  /** Gerente/chefe: o nome do cliente liga à ficha do cliente. */
  ligarAoCliente: boolean
}

/** Onde é o trabalho: cliente, morada, notas para a equipa e botões para lá chegar. */
export function CartaoLocal({ local, cliente, ligarAoCliente }: Props) {
  const morada = local
    ? moradaCompleta({ morada: local.morada, codigoPostal: local.codigo_postal, localidade: local.localidade })
    : ""
  const destino = { latitude: local?.latitude, longitude: local?.longitude, morada }
  const googleMaps = local ? urlGoogleMaps(destino) : null
  const waze = local ? urlWaze(destino) : null
  const numero = cliente?.telemovel || cliente?.telefone || null
  const area = formatarArea(local?.area_m2)

  return (
    <div className="grid gap-4 text-sm">
      <div className="grid gap-1">
        {cliente && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <UserRoundIcon className="size-4 shrink-0" aria-hidden="true" />
            {ligarAoCliente ? (
              <Link href={`/clientes/${cliente.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                {cliente.nome}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{cliente.nome}</span>
            )}
            {cliente.pessoa_contacto && <span>· {cliente.pessoa_contacto}</span>}
          </p>
        )}
        {local ? (
          <div className="flex gap-2">
            <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold">{local.nome}</p>
              <p>{morada}</p>
              {area && <p className="text-muted-foreground">Área: {area}</p>}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Não foi possível carregar o local.</p>
        )}
      </div>

      {local?.notas && (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Notas para a equipa</p>
            <p className="whitespace-pre-line">{local.notas}</p>
          </div>
        </div>
      )}

      {(googleMaps || waze || numero) && (
        <div className="grid gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap">
          {googleMaps && (
            <Button asChild variant="secondary" size="lg">
              <a href={googleMaps} target="_blank" rel="noopener noreferrer">
                <MapPinIcon />
                Google Maps
              </a>
            </Button>
          )}
          {waze && (
            <Button asChild variant="secondary" size="lg">
              <a href={waze} target="_blank" rel="noopener noreferrer">
                <NavigationIcon />
                Waze
              </a>
            </Button>
          )}
          {numero && (
            <Button asChild variant="outline" size="lg" className="min-[360px]:col-span-2">
              <a href={`tel:${numeroParaLigacao(numero)}`}>
                <PhoneIcon />
                Ligar ao cliente
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
