import Link from "next/link"
import { ChevronRightIcon, MapPinIcon, NavigationIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react"

import { PicarAqui } from "@/components/horas/picar-aqui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatarHora } from "@/lib/formatar"
import { moradaCompleta, urlGoogleMaps, urlWaze } from "@/lib/mapas"
import { cn } from "@/lib/utils"
import { NOMES_ESTADO_TRABALHO, VARIANTE_ESTADO_TRABALHO, type EstadoTrabalho } from "@/lib/trabalhos"

export type TrabalhoHoje = {
  id: string
  titulo: string
  hora_inicio: string | null
  estado: EstadoTrabalho
  ordem: number
  equipa: { id: string; nome: string; cor: string } | null
  cliente: { nome: string; telemovel: string | null; telefone: string | null } | null
  local: {
    nome: string
    morada: string
    codigo_postal: string | null
    localidade: string | null
    latitude: number | null
    longitude: number | null
    notas: string | null
  } | null
}

/** Número só com algarismos e "+", para a ligação tel:. */
function numeroParaLigacao(numero: string) {
  return numero.replace(/[^\d+]/g, "")
}

type Props = {
  trabalho: TrabalhoHoje
  /** A pessoa está a picar neste trabalho. */
  atual: boolean
  /** A pessoa tem uma entrada aberta (hoje) noutro trabalho. */
  aTrabalhar: boolean
}

/** Cartão grande de um trabalho de hoje: onde é, notas e botões para lá chegar. */
export function CartaoTrabalhoHoje({ trabalho, atual, aTrabalhar }: Props) {
  const { local, cliente } = trabalho
  const morada = local
    ? moradaCompleta({ morada: local.morada, codigoPostal: local.codigo_postal, localidade: local.localidade })
    : ""
  const destino = { latitude: local?.latitude, longitude: local?.longitude, morada }
  const googleMaps = local ? urlGoogleMaps(destino) : null
  const waze = local ? urlWaze(destino) : null
  const numero = cliente?.telemovel || cliente?.telefone || null
  const cancelado = trabalho.estado === "cancelado"
  const podePicar = trabalho.estado === "agendado" || trabalho.estado === "em_curso"
  const hora = trabalho.hora_inicio ? formatarHora(trabalho.hora_inicio) : null

  // Botões em "mosaico" (ícone por cima do texto): três cabem à largura de um telemóvel.
  const mosaico = "h-14 flex-1 flex-col gap-0.5 px-1 text-sm [&_svg:not([class*='size-'])]:size-5"

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        atual && "border-primary ring-1 ring-primary",
        cancelado && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 min-w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent px-2 text-accent-foreground">
          <span className="text-lg leading-none font-semibold tabular-nums">{hora ?? "—"}</span>
          {!hora && <span className="text-[11px] leading-tight">sem hora</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base leading-snug font-semibold text-pretty">{trabalho.titulo}</h3>
            <Badge variant={VARIANTE_ESTADO_TRABALHO[trabalho.estado]} className="mt-0.5">
              {NOMES_ESTADO_TRABALHO[trabalho.estado]}
            </Badge>
          </div>
          {cliente && <p className="text-sm font-medium">{cliente.nome}</p>}
          {local && (
            <p className="mt-0.5 flex gap-1 text-sm text-muted-foreground">
              <MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {local.nome}
                {morada && ` · ${morada}`}
              </span>
            </p>
          )}
        </div>
      </div>

      {local?.notas && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="line-clamp-3 whitespace-pre-line">
            <span className="sr-only">Notas para a equipa: </span>
            {local.notas}
          </span>
        </p>
      )}

      <div className="mt-3 grid gap-2">
        {podePicar && <PicarAqui trabalhoId={trabalho.id} atual={atual} aTrabalhar={aTrabalhar} className="w-full" />}
        <div className="flex gap-2">
          {googleMaps && (
            <Button asChild variant="secondary" size="lg" className={mosaico}>
              <a href={googleMaps} target="_blank" rel="noopener noreferrer">
                <NavigationIcon />
                Navegar
              </a>
            </Button>
          )}
          {numero && (
            <Button asChild variant="secondary" size="lg" className={mosaico}>
              <a href={`tel:${numeroParaLigacao(numero)}`}>
                <PhoneIcon />
                Ligar
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className={mosaico}>
            <Link href={`/trabalhos/${trabalho.id}`}>
              <ChevronRightIcon />
              Abrir
            </Link>
          </Button>
        </div>
        {waze && (
          <Button asChild variant="ghost" size="sm" className="h-11 justify-self-start text-muted-foreground">
            <a href={waze} target="_blank" rel="noopener noreferrer">
              <NavigationIcon />
              Abrir no Waze
            </a>
          </Button>
        )}
      </div>
    </li>
  )
}
