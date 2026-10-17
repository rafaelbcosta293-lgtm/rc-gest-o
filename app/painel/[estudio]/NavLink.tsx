'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULOS, PALETA } from '@/lib/data/constantes'

// Destaca o módulo atual no menu — sem isto, a barra lateral/superior
// não dava nenhuma pista de "estás aqui", em toda a navegação da app.
function estaAtivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Recebe só o id (uma string) e procura o ícone/cor aqui dentro — um
// componente de ícone (função) não pode atravessar a fronteira
// servidor→cliente como prop, só dados simples podem.
function moduloPorId(id: string) {
  return MODULOS.find((m) => m.id === id)!
}

export function NavLinkDesktop({ href, id, nome }: { href: string; id: string; nome: string }) {
  const { icone: Icone, cor } = moduloPorId(id)
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

export function NavLinkMobile({ href, id, nome }: { href: string; id: string; nome: string }) {
  const { icone: Icone, cor } = moduloPorId(id)
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
