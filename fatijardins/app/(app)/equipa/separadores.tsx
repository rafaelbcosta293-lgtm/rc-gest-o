"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UsersIcon, UsersRoundIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Separador = "colaboradores" | "equipas"

const SEPARADORES = [
  { id: "colaboradores", href: "/equipa", rotulo: "Colaboradores", icone: UsersRoundIcon },
  { id: "equipas", href: "/equipa/equipas", rotulo: "Equipas", icone: UsersIcon },
] as const

/** Lista de separadores (sem estado; o ativo vem de fora). */
export function ListaSeparadores({ ativo }: { ativo: Separador | null }) {
  return (
    <nav aria-label="Secções da equipa" className="mb-5 md:mb-6">
      <ul className="flex w-full rounded-lg bg-muted p-1 sm:w-fit">
        {SEPARADORES.map(({ id, href, rotulo, icone: Icone }) => {
          const eAtivo = ativo === id
          return (
            <li key={id} className="flex-1 sm:flex-none">
              <Link
                href={href}
                aria-current={eAtivo ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
                  eAtivo
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icone className="size-4" />
                {rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Separadores "Colaboradores" / "Equipas" com o ativo conforme o endereço. */
export function SeparadoresEquipa() {
  const pathname = usePathname()
  const ativo: Separador = pathname.startsWith("/equipa/equipas") ? "equipas" : "colaboradores"
  return <ListaSeparadores ativo={ativo} />
}
