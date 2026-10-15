"use client"

import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Envio, EstadoEnvio } from "./use-envio-fotos"

const TEXTO_ESTADO: Record<Exclude<EstadoEnvio, "erro">, string> = {
  em_espera: "À espera…",
  a_comprimir: "A comprimir…",
  a_enviar: "A enviar…",
  feito: "Enviada.",
}

/** Uma foto na fila de envio (estado, erro e "Tentar de novo"). */
export function LinhaEnvio<D>({
  envio,
  rotulo,
  aoTentarDeNovo,
  aoDescartar,
}: {
  envio: Envio<D>
  /** Ex.: "Foto antes". */
  rotulo: string
  aoTentarDeNovo: () => void
  aoDescartar: () => void
}) {
  const Icone =
    envio.estado === "feito"
      ? CircleCheckIcon
      : envio.estado === "erro"
        ? CircleAlertIcon
        : envio.estado === "em_espera"
          ? ClockIcon
          : LoaderCircleIcon

  return (
    <li className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Icone
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-5 shrink-0",
            envio.estado === "feito" && "text-primary",
            envio.estado === "erro" && "text-destructive",
            (envio.estado === "a_comprimir" || envio.estado === "a_enviar") && "animate-spin text-muted-foreground",
            envio.estado === "em_espera" && "text-muted-foreground"
          )}
        />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {rotulo}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {(envio.ficheiro.size / (1024 * 1024)).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB
            </span>
          </p>
          <p className={envio.estado === "erro" ? "text-destructive" : "text-muted-foreground"}>
            {envio.estado === "erro" ? envio.erro : TEXTO_ESTADO[envio.estado]}
          </p>
        </div>
      </div>
      {envio.estado === "erro" && (
        <div className="flex gap-2">
          <Button type="button" size="lg" variant="outline" className="flex-1" onClick={aoTentarDeNovo}>
            <RotateCwIcon />
            Tentar de novo
          </Button>
          <Button type="button" size="icon-lg" variant="ghost" aria-label="Descartar esta foto" onClick={aoDescartar}>
            <XIcon className="size-5" />
          </Button>
        </div>
      )}
    </li>
  )
}
