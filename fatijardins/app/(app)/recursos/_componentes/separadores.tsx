"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const SEPARADORES = [
  { href: "/recursos", rotulo: "Equipamentos" },
  { href: "/recursos/consumiveis", rotulo: "Consumíveis" },
]

/**
 * Alterna entre equipamentos (/recursos e /recursos/equipamentos/…) e
 * consumíveis (/recursos/consumiveis/…).
 */
export function SeparadoresRecursos() {
  const pathname = usePathname()
  const emConsumiveis = pathname === "/recursos/consumiveis" || pathname.startsWith("/recursos/consumiveis/")
  return (
    <nav aria-label="Equipamentos e consumíveis" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-fit">
      {SEPARADORES.map((separador) => {
        const ativo = separador.href === "/recursos/consumiveis" ? emConsumiveis : !emConsumiveis
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
