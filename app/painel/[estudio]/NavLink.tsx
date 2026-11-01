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

// Computador/tablet (≥768px): barra superior horizontal, ícone + nome,
// numa pílula — substitui as duas barras laterais antigas.
export function NavLinkTopBar({ href, id, nome }: { href: string; id: string; nome: string }) {
  const { icone: Icone, cor } = moduloPorId(id)
  const ativo = estaAtivo(usePathname(), href)
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold tracking-wide text-foreground transition-all ${
        ativo ? '' : 'border border-border-subtle hover:border-border-strong hover:bg-foreground/[.04]'
      }`}
      style={{
        background: ativo ? PALETA[cor].bg : undefined,
        // Inativo: nome sempre a preto (var(--foreground), da className),
        // bem legível em qualquer pasta — só o ícone fica na cor própria
        // do módulo, para a barra continuar colorida e fácil de
        // reconhecer de relance, mesmo sem nada selecionado.
        color: ativo ? PALETA[cor].tx : undefined,
        // O brilho acompanha a cor do próprio módulo (em vez de um tom
        // único para todos) — cada separador ativo "ilumina-se" com a
        // sua própria cor, como os indicadores de um painel técnico.
        boxShadow: ativo ? `var(--shadow-pop-value), 0 0 0 1px ${PALETA[cor].tx}40, 0 6px 18px -4px ${PALETA[cor].tx}70` : undefined,
      }}
    >
      <Icone className="h-4 w-4" strokeWidth={2.5} style={{ color: ativo ? undefined : PALETA[cor].tx }} />
      {nome}
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
      <Icone className="h-[22px] w-[22px]" strokeWidth={ativo ? 2.75 : 2.25} />
      <span className={`text-[10px] ${ativo ? 'font-semibold' : 'font-medium'}`}>{curto ?? nome}</span>
    </Link>
  )
}
