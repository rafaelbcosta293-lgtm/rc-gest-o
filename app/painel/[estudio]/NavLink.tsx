'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { PALETA } from '@/lib/data/constantes'

// Destaca o módulo atual no menu — sem isto, a barra lateral/superior
// não dava nenhuma pista de "estás aqui", em toda a navegação da app.
function estaAtivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function NavLinkDesktop({
  href,
  icone: Icone,
  nome,
  cor,
}: {
  href: string
  icone: LucideIcon
  nome: string
  cor: keyof typeof PALETA
}) {
  const ativo = estaAtivo(usePathname(), href)
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
        ativo ? 'bg-brand/15 text-foreground' : 'text-foreground/75 hover:bg-brand/[.07] hover:text-foreground'
      }`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: PALETA[cor].bg, color: PALETA[cor].tx }}
      >
        <Icone className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      {nome}
    </Link>
  )
}

export function NavLinkMobile({
  href,
  icone: Icone,
  nome,
  cor,
}: {
  href: string
  icone: LucideIcon
  nome: string
  cor: keyof typeof PALETA
}) {
  const ativo = estaAtivo(usePathname(), href)
  return (
    <Link
      href={href}
      title={nome}
      aria-label={nome}
      className={`flex shrink-0 items-center justify-center rounded-full p-2 transition-colors ${
        ativo ? '' : 'hover:bg-brand/[.07]'
      }`}
      style={ativo ? { background: PALETA[cor].bg, color: PALETA[cor].tx } : undefined}
    >
      <Icone className="h-[18px] w-[18px]" strokeWidth={2.25} />
    </Link>
  )
}
