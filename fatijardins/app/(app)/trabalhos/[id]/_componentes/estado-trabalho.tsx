"use client"

import { useTransition } from "react"
import { CircleCheckIcon, LoaderCircleIcon, PlayIcon, RotateCcwIcon, CircleXIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { ResultadoAcao } from "@/lib/acoes"
import type { EstadoTrabalho } from "@/lib/trabalhos"
import { mudarEstado } from "../acoes"
import { Confirmar } from "./confirmar"

type Props = {
  trabalhoId: string
  estado: EstadoTrabalho
  /** Gerente ou chefe de equipa: também cancela e reabre. */
  podeGerir: boolean
  /** Botão "Picar aqui" (só nos trabalhos de hoje por fazer). */
  picagem?: React.ReactNode
}

/** Botões grandes para mudar o estado do trabalho. */
export function EstadoTrabalhoBotoes({ trabalhoId, estado, podeGerir, picagem }: Props) {
  const [aIniciar, iniciar] = useTransition()

  function iniciarTrabalho() {
    iniciar(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await mudarEstado(trabalhoId, "em_curso")
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      if (resultado.ok) toast.success(resultado.mensagem ?? "Trabalho iniciado.")
      else toast.error(resultado.erro)
    })
  }

  const podeIniciar = estado === "agendado"
  const podeConcluir = estado === "agendado" || estado === "em_curso"
  const podeCancelar = podeGerir && (estado === "agendado" || estado === "em_curso")
  const podeReabrir = podeGerir && (estado === "concluido" || estado === "cancelado")

  return (
    <div className="grid gap-3">
      {estado === "concluido" && (
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <CircleCheckIcon className="size-5" aria-hidden="true" />
          Trabalho concluído.
        </p>
      )}
      {estado === "cancelado" && (
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CircleXIcon className="size-5" aria-hidden="true" />
          Este trabalho foi cancelado.
        </p>
      )}

      {picagem}

      {(podeIniciar || podeConcluir) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {podeIniciar && (
            <Button size="lg" onClick={iniciarTrabalho} disabled={aIniciar}>
              {aIniciar ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
              Iniciar trabalho
            </Button>
          )}
          {podeConcluir && (
            <Confirmar
              gatilho={
                <Button
                  size="lg"
                  variant={podeIniciar ? "outline" : "default"}
                  className={podeIniciar ? undefined : "sm:col-span-2"}
                >
                  <CircleCheckIcon />
                  Concluir
                </Button>
              }
              titulo="Concluir este trabalho?"
              descricao="Confirme que já guardou o registo do dia, os materiais e as fotos."
              confirmar="Concluir"
              variante="default"
              acao={() => mudarEstado(trabalhoId, "concluido")}
            />
          )}
        </div>
      )}

      {(podeCancelar || podeReabrir) && (
        <div className="flex flex-wrap gap-2">
          {podeCancelar && (
            <Confirmar
              gatilho={
                <Button size="lg" variant="ghost" className="text-destructive hover:text-destructive">
                  <CircleXIcon />
                  Cancelar trabalho
                </Button>
              }
              titulo="Cancelar este trabalho?"
              descricao="O trabalho fica marcado como cancelado. Pode reabri-lo mais tarde."
              confirmar="Cancelar trabalho"
              acao={() => mudarEstado(trabalhoId, "cancelado")}
            />
          )}
          {podeReabrir && (
            <Confirmar
              gatilho={
                <Button size="lg" variant="outline">
                  <RotateCcwIcon />
                  Reabrir
                </Button>
              }
              titulo="Reabrir este trabalho?"
              descricao="O trabalho volta a ficar agendado. O registo, os materiais e as fotos mantêm-se."
              confirmar="Reabrir"
              variante="default"
              acao={() => mudarEstado(trabalhoId, "agendado")}
            />
          )}
        </div>
      )}

      {!picagem && <p className="text-sm text-muted-foreground">As horas registam-se na picagem, no Início.</p>}
    </div>
  )
}
