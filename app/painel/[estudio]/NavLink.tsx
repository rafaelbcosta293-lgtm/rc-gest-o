'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULOS, PALETA } from '@/lib/data/constantes'

// Destaca o módulo atual no menu — sem isto, a navegação não dava
// nenhuma pista de "estás aqui".
function estaAtivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Recebe só o id (uma string) e procura o ícone/cor aqui dentro — um
// componente de ícone (função) não pode atravessar a fronteira
// servidor→cliente como prop, só dados simples podem.
function moduloPorId(id: string) {
  return MODULOS.find((m) => m.id === id)!
}

// Computador (≥1024px): barra lateral completa, ícone + nome.
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

// Tablet (768–1023px): barra lateral estreita, só com ícone — cabe mais
// ecrã de conteúdo sem perder a navegação sempre visível.
export function NavLinkTablet({ href, id, nome }: { href: string; id: string; nome: string }) {
  const { icone: Icone, cor } = moduloPorId(id)
  const ativo = estaAtivo(usePathname(), href)
  return (
    <Link
      href={href}
      title={nome}
      aria-label={nome}
      className="flex items-center justify-center rounded-xl p-3 transition-colors"
      style={{
        background: ativo ? PALETA[cor].bg : undefined,
        color: ativo ? PALETA[cor].tx : 'var(--muted)',
      }}
    >
      <Icone className="h-5 w-5" strokeWidth={2.25} />
    </Link>
  )
}

// Telemóvel (<768px): barra fixa no fundo, ao estilo iOS — ícone +
// legenda pequena, sempre ao alcance do polegar.
export function NavLinkPhone({ href, id }: { href: string; id: string }) {
  const { icone: Icone, cor, nome, curto } = moduloPorId(id)
  const ativo = estaAtivo(usePathname(), href)
  return (
    <Link
      href={href}
      aria-label={nome}
      className="flex min-w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5"
      style={{ color: ativo ? PALETA[cor].tx : 'var(--muted)' }}
    >
      <Icone className="h-[22px] w-[22px]" strokeWidth={ativo ? 2.5 : 2} />
      <span className={`text-[10px] ${ativo ? 'font-semibold' : 'font-medium'}`}>{curto ?? nome}</span>
    </Link>
  )
}
