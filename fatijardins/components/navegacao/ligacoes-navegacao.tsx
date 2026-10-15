"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  ClockIcon,
  EllipsisIcon,
  FileTextIcon,
  HouseIcon,
  TreesIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { IconeNavegacao, ItemNavegacao } from "./itens"

const ICONES: Record<IconeNavegacao, LucideIcon> = {
  inicio: HouseIcon,
  agenda: CalendarDaysIcon,
  orcamentos: FileTextIcon,
  clientes: TreesIcon,
  horas: ClockIcon,
  equipa: UsersIcon,
  perfil: UserRoundIcon,
}

function estaAtivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

/** Menu lateral (PC). */
export function LigacoesLaterais({ itens }: { itens: ItemNavegacao[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      {itens.map((item) => {
        const Icone = ICONES[item.icone]
        const ativo = estaAtivo(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icone className={cn("size-5", ativo && "text-sidebar-primary")} />
            {item.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}

/** Barra inferior (telemóvel): botões grandes, fáceis de carregar com o dedo. */
export function LigacoesInferiores({ itens, mais }: { itens: ItemNavegacao[]; mais: ItemNavegacao[] }) {
  const pathname = usePathname()
  const maisAtivo = mais.some((item) => estaAtivo(pathname, item.href))
  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {itens.map((item) => {
          const Icone = ICONES[item.icone]
          const ativo = estaAtivo(pathname, item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  ativo ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    ativo && "bg-accent"
                  )}
                >
                  <Icone className="size-6" />
                </span>
                {item.rotulo}
              </Link>
            </li>
          )
        })}
        {mais.length > 0 && (
          <li className="flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  maisAtivo ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    maisAtivo && "bg-accent"
                  )}
                >
                  <EllipsisIcon className="size-6" />
                </span>
                Mais
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="min-w-48">
                {mais.map((item) => {
                  const Icone = ICONES[item.icone]
                  const ativo = estaAtivo(pathname, item.href)
                  return (
                    <DropdownMenuItem key={item.href} asChild className="h-12 gap-3 text-base">
                      <Link href={item.href} aria-current={ativo ? "page" : undefined}>
                        <Icone className="size-5" />
                        {item.rotulo}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </ul>
    </nav>
  )
}
