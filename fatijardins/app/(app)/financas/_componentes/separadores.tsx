"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const SEPARADORES = [
  { href: "/financas", rotulo: "Dívidas" },
  { href: "/financas/cobrancas", rotulo: "Cobranças" },
  { href: "/financas/pagamentos", rotulo: "Pagamentos" },
  { href: "/financas/contratos", rotulo: "Contratos" },
]

function separadorAtivo(pathname: string): string {
  const outro = SEPARADORES.slice(1).find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
  return outro?.href ?? "/financas"
}

/** Dívidas (/financas), cobranças, pagamentos e contratos (todas só do gerente). */
export function SeparadoresFinancas() {
  const ativo = separadorAtivo(usePathname())
  return (
    <nav aria-label="Finanças" className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 sm:w-fit">
      {SEPARADORES.map((separador) => {
        const eAtivo = separador.href === ativo
        return (
          <Link
            key={separador.href}
            href={separador.href}
            aria-current={eAtivo ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center rounded-md px-1 text-[13px] font-medium transition-colors sm:px-5 sm:text-sm",
              eAtivo ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {separador.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
