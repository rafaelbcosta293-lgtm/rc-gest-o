"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const SEPARADORES = [
  { href: "/orcamentos", rotulo: "Orçamentos" },
  { href: "/orcamentos/visitas", rotulo: "Visitas" },
]

/** Alterna entre a lista de orçamentos e a de visitas (ambas em /orcamentos). */
export function SeparadoresOrcamentos() {
  const pathname = usePathname()
  const emVisitas = pathname === "/orcamentos/visitas" || pathname.startsWith("/orcamentos/visitas/")
  return (
    <nav aria-label="Orçamentos e visitas" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-fit">
      {SEPARADORES.map((separador) => {
        const ativo = separador.href === "/orcamentos/visitas" ? emVisitas : !emVisitas
        return (
          <Link
            key={separador.href}
            href={separador.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors",
              ativo ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {separador.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
