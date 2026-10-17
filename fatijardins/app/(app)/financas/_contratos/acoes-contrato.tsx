"use client"

import { CircleStopIcon, PauseIcon, PlayIcon } from "lucide-react"

import { Confirmar } from "@/app/(app)/trabalhos/[id]/_componentes/confirmar"
import { Button } from "@/components/ui/button"
import type { EstadoContrato } from "@/lib/financas"
import { alterarEstadoContrato } from "./acoes"

/** Suspender, reativar e terminar um contrato (com confirmação). */
export function AcoesEstadoContrato({
  id,
  titulo,
  estado,
}: {
  id: string
  titulo: string
  estado: EstadoContrato
}) {
  return (
    <>
      {estado === "ativo" && (
        <Confirmar
          gatilho={
            <Button variant="outline" size="lg">
              <PauseIcon />
              Suspender
            </Button>
          }
          titulo="Suspender este contrato?"
          descricao={
            <>
              <strong>{titulo}</strong> fica suspenso: as visitas futuras ainda por começar saem da agenda e não são
              criadas novas cobranças. Pode reativá-lo depois (os meses em que esteve suspenso não são cobrados).
            </>
          }
          confirmar="Suspender"
          variante="default"
          acao={() => alterarEstadoContrato(id, "suspenso")}
        />
      )}
      {estado !== "ativo" && (
        <Confirmar
          gatilho={
            <Button variant="outline" size="lg">
              <PlayIcon />
              Reativar
            </Button>
          }
          titulo="Reativar este contrato?"
          descricao={
            <>
              As visitas das próximas semanas de <strong>{titulo}</strong> voltam à agenda e a cobrança mensal recomeça
              neste mês. Os meses em que esteve {estado === "suspenso" ? "suspenso" : "terminado"} não são cobrados.
            </>
          }
          confirmar="Reativar"
          variante="default"
          acao={() => alterarEstadoContrato(id, "ativo")}
        />
      )}
      {estado !== "terminado" && (
        <Confirmar
          gatilho={
            <Button variant="outline" size="lg" className="text-destructive hover:text-destructive">
              <CircleStopIcon />
              Terminar
            </Button>
          }
          titulo="Terminar este contrato?"
          descricao={
            <>
              <strong>{titulo}</strong> termina: as visitas futuras ainda por começar saem da agenda e não são criadas
              novas cobranças. As visitas feitas e as cobranças já criadas ficam no histórico.
            </>
          }
          confirmar="Terminar"
          acao={() => alterarEstadoContrato(id, "terminado")}
        />
      )}
    </>
  )
}
