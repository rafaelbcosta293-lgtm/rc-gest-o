"use client"

import { cn } from "@/lib/utils"

type Props = {
  id: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  className?: string
}

/**
 * Interruptor simples (botão com role="switch"), com o aspeto do Switch de
 * components/ui. O Switch do Radix desenha no servidor uma caixa escondida
 * para formulários que, fora de um <form>, só servia para dar avisos de
 * hidratação; aqui não há formulário.
 */
export function Interruptor({ id, ligado, aoMudar, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={ligado}
      data-state={ligado ? "checked" : "unchecked"}
      onClick={() => aoMudar(!ligado)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // Área de toque de 44 px sem aumentar o desenho.
        "before:absolute before:-inset-2.5 before:content-['']",
        ligado ? "bg-primary" : "bg-input dark:bg-input/80",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-background ring-0 transition-transform",
          ligado ? "translate-x-5 dark:bg-primary-foreground" : "translate-x-0.5 dark:bg-foreground"
        )}
      />
    </button>
  )
}
