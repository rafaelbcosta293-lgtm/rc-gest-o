"use client"

import { cn } from "@/lib/utils"

/** Grupo de botões grandes (rádio) para escolher uma opção com o dedo. */
export function Opcoes<T extends string>({
  nome,
  rotulo,
  valor,
  opcoes,
  aoMudar,
  className,
}: {
  nome: string
  rotulo: string
  valor: string
  opcoes: { valor: T; nome: string }[]
  aoMudar: (valor: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn("grid gap-2", className)}>
      {opcoes.map((opcao) => (
        <label
          key={opcao.valor}
          className={cn(
            "flex h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
            valor === opcao.valor ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
          )}
        >
          <input
            type="radio"
            name={nome}
            value={opcao.valor}
            checked={valor === opcao.valor}
            onChange={() => aoMudar(opcao.valor)}
            className="sr-only"
          />
          {opcao.nome}
        </label>
      ))}
    </div>
  )
}
