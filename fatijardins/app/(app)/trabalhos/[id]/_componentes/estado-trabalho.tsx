"use client"

import { useTransition } from "react"
import { CircleCheckIcon, LoaderCircleIcon, PlayIcon, RotateCcwIcon, CircleXIcon } from "lucide-react"
import { toast } from "sonner"

import { PicarAqui } from "@/components/horas/picar-aqui"
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
  /**
   * Picagem neste trabalho (só nos trabalhos de hoje por fazer); null = não se pica aqui.
   * atual: a pessoa está a picar aqui; aTrabalhar: tem uma entrada aberta noutro trabalho.
   */
  picagem: { atual: boolean; aTrabalhar: boolean } | null
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

  // O colaborador só tem as transições que a BD lhe aceita: agendado → em curso; agendado/em curso → concluído.
  const podeIniciar = estado === "agendado"
  const podeConcluir = estado === "agendado" || estado === "em_curso"
  const podeCancelar = podeGerir && (estado === "agendado" || estado === "em_curso")
  const podeReabrir = podeGerir && (estado === "concluido" || estado === "cancelado")
  // "Iniciar" só muda o estado e não conta horas: enquanto a pessoa não está a picar aqui,
  // a ação principal é picar.
  const picarPrincipal = picagem !== null && !picagem.atual
  const nomePicar = picagem?.aTrabalhar ? "Mudar para aqui" : "Picar aqui"

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

      {picagem && (
        <PicarAqui
          trabalhoId={trabalhoId}
          atual={picagem.atual}
          aTrabalhar={picagem.aTrabalhar}
          principal={picarPrincipal}
          className="w-full"
        />
      )}

      {(podeIniciar || podeConcluir) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {podeIniciar && (
            <Button
              size="lg"
              variant={picarPrincipal ? "outline" : "default"}
              onClick={iniciarTrabalho}
              disabled={aIniciar}
            >
              {aIniciar ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
              Iniciar trabalho
            </Button>
          )}
          {podeConcluir && (
            <Confirmar
              gatilho={
                <Button
                  size="lg"
                  variant={podeIniciar || picarPrincipal ? "outline" : "default"}
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
      {podeIniciar && picarPrincipal && (
        <p className="text-sm text-muted-foreground">
          Iniciar só muda o estado do trabalho. Para contar as horas, use “{nomePicar}”.
        </p>
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
