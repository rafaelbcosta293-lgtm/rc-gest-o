'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

// Item do menu horizontal de "pastas" (Administração/Coordenação) —
// cada área tem o seu próprio conjunto fixo, por isso recebe os dados
// como props em vez de ler de uma constante partilhada (essa, MODULOS,
// é só para os módulos por estúdio). Mesmo formato compacto (ícone em
// cima, nome por baixo) da barra do telemóvel — cabem muito mais
// pastas por pixel de largura do que no formato antigo de pílula
// horizontal.
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
      className={`flex min-w-12 shrink-0 flex-col items-center gap-0.5 whitespace-nowrap rounded-lg px-1.5 py-1 transition-colors hover:bg-brand/[.08] ${
        ativo ? 'font-semibold text-brand' : 'font-medium text-foreground'
      }`}
    >
      <Icone className="h-[18px] w-[18px]" strokeWidth={ativo ? 2.5 : 2.25} />
      <span className="text-[10px] leading-none tracking-tight">{label}</span>
    </Link>
  )
}
