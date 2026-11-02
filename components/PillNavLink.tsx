'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { useModoIcone } from './BarraAjustavel'

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
  const soIcone = useModoIcone()
  return (
    <Link
      href={href}
      title={soIcone ? label : undefined}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full transition-colors hover:bg-brand/[.08] ${
        soIcone ? 'p-2' : 'px-3 py-1.5'
      } text-[13px] font-medium tracking-tight ${ativo ? 'bg-brand/20 text-brand' : 'text-foreground'}`}
    >
      <Icone className="h-3.5 w-3.5" strokeWidth={ativo ? 2.5 : 2.25} />
      {!soIcone && label}
    </Link>
  )
}
