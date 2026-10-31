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
  // Pílulas maiores, com contorno sempre visível e letras mais fortes —
  // só a Administração pede este destaque; a Coordenação mantém o
  // visual mais discreto de sempre (prop por omissão a false).
  destaque = false,
}: {
  href: string
  label: string
  icone: LucideIcon
  exato?: boolean
  destaque?: boolean
}) {
  const ativo = estaAtivoPill(usePathname(), href, exato)
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center whitespace-nowrap rounded-full transition-all ${
        destaque ? 'gap-2 border-2 px-4 py-2 text-[13px] font-bold tracking-wide' : 'gap-1.5 px-3 py-1.5 text-sm font-semibold'
      } ${
        ativo
          ? destaque
            ? 'shadow-glow-brand border-brand bg-brand/20 text-foreground'
            : 'shadow-glow-brand bg-brand/15 text-foreground'
          : destaque
            ? 'border-border-strong text-foreground/85 hover:border-brand/60 hover:bg-brand/[.1] hover:text-foreground'
            : 'text-foreground/70 hover:bg-brand/[.07] hover:text-foreground'
      }`}
    >
      <Icone className={destaque ? 'h-[18px] w-[18px]' : 'h-4 w-4'} strokeWidth={2.5} />
      {label}
    </Link>
  )
}
