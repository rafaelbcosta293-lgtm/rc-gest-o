'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { formaPilula, useModoBarra } from './BarraAjustavel'

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
  aviso = 0,
}: {
  href: string
  label: string
  icone: LucideIcon
  exato?: boolean
  // Número a mostrar junto ao nome ("Calendário (3)"), como nos grupos.
  aviso?: number
}) {
  const ativo = estaAtivoPill(usePathname(), href, exato)
  const modo = useModoBarra()
  const nome = aviso > 0 ? `${label} (${aviso})` : label
  return (
    <Link
      href={href}
      title={modo === 'icones' ? nome : undefined}
      className={`flex shrink-0 whitespace-nowrap font-medium tracking-tight transition-colors hover:bg-brand/[.08] ${formaPilula(modo)} ${
        ativo ? 'bg-brand/20 text-brand' : 'text-foreground'
      }`}
    >
      <Icone className={modo === 'empilhado' ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={ativo ? 2.5 : 2.25} />
      {modo !== 'icones' && nome}
    </Link>
  )
}
