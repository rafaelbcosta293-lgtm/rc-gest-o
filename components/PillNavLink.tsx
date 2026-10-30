'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

// Item do menu horizontal de "pastas" (Administração/Coordenação) —
// cada área tem o seu próprio conjunto fixo, por isso recebe os dados
// como props em vez de ler de uma constante partilhada (essa, MODULOS,
// é só para os módulos por estúdio).
export function estaAtivoPill(pathname: string, href: string, exato = false) {
  if (exato) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function PillNavLink({
  href,
  label,
  icone: Icone,
  exato = false,
}: {
  href: string
  label: string
  icone: LucideIcon
  exato?: boolean
}) {
  const ativo = estaAtivoPill(usePathname(), href, exato)
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
        ativo
          ? 'bg-brand/15 text-foreground'
          : 'text-foreground/70 hover:bg-brand/[.07] hover:text-foreground'
      }`}
    >
      <Icone className="h-4 w-4" strokeWidth={2.5} />
      {label}
    </Link>
  )
}
