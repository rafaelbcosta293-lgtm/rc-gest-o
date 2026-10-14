"use client"

import { CircleDotIcon, LoaderCircleIcon, LogInIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePicagem } from "./contexto-picagem"

type Props = {
  trabalhoId: string
  /** A pessoa está a picar neste trabalho agora. */
  atual: boolean
  /** Há uma entrada aberta noutro trabalho (o botão muda de trabalho). */
  aTrabalhar: boolean
  /** Botão cheio: a ação principal (na ficha, à frente de "Iniciar trabalho"). */
  principal?: boolean
  className?: string
}

/** Pica a entrada (ou muda) diretamente para este trabalho. Usa a mesma ação do widget. */
export function PicarAqui({ trabalhoId, atual, aTrabalhar, principal = false, className }: Props) {
  const { aCorrer, entrar } = usePicagem()

  if (atual) {
    return (
      <p
        className={cn(
          "flex h-12 items-center justify-center gap-2 rounded-lg bg-primary/10 text-base font-medium text-primary",
          className
        )}
      >
        <CircleDotIcon className="size-5" aria-hidden="true" />A trabalhar aqui
      </p>
    )
  }

  return (
    <Button
      size="lg"
      variant={principal ? "default" : "outline"}
      disabled={aCorrer}
      onClick={() => entrar(trabalhoId)}
      className={cn(!principal && "border-primary/50 text-primary hover:text-primary", className)}
    >
      {aCorrer ? <LoaderCircleIcon className="animate-spin" /> : <LogInIcon />}
      {aTrabalhar ? "Mudar para aqui" : "Picar aqui"}
    </Button>
  )
}
