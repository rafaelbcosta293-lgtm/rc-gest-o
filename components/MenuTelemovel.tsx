'use client'

import { useState } from 'react'
import Link from '@/components/LinkRapido'
import { usePathname } from 'next/navigation'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import FolhaInferior from './FolhaInferior'
import { estaAtivoPill } from './PillNavLink'

// Menu das áreas com "pastas" (Administração e Coordenação) no telemóvel:
// em vez da barra de ícones sem nome, um botão com a pasta aberta que
// abre a lista completa, com nomes, numa folha ao fundo do ecrã.
export type ItemMenu = {
  href: string
  label: string
  icone: LucideIcon
  exato?: boolean
  aviso?: number
  // Atalhos ao lado do nome (ex.: "Fátima" / "Leiria").
  atalhos?: { href: string; label: string }[]
}
export type GrupoMenu = { label?: string; itens: ItemMenu[] }

export default function MenuTelemovel({ titulo, grupos, escuro = false, className = '' }: { titulo: string; grupos: GrupoMenu[]; escuro?: boolean; className?: string }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const todos = grupos.flatMap((g) => g.itens)
  const atual = todos.find((i) => estaAtivoPill(pathname, i.href, i.exato)) ?? todos[0]
  const avisos = todos.reduce((s, i) => s + (i.aviso ?? 0), 0)
  const IconeAtual = atual.icone

  return (
    <div className={`min-w-0 flex-1 justify-end ${className}`}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="flex h-10 max-w-full min-w-0 items-center gap-2 rounded-full border border-border-subtle bg-foreground/[.04] pr-3 pl-3.5 text-sm font-semibold text-foreground active:bg-foreground/[.08]"
      >
        <IconeAtual className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.4} />
        <span className="truncate">{atual.label}</span>
        {avisos > 0 && <span className="shrink-0 rounded-full bg-brand px-1.5 text-[11px] leading-5 font-bold text-black">{avisos}</span>}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" strokeWidth={2.4} />
      </button>

      <FolhaInferior aberta={aberto} aoFechar={() => setAberto(false)} titulo={titulo} escuro={escuro}>
        {grupos.map((g, i) => (
          <div key={g.label ?? i} className={i > 0 ? 'mt-3' : ''}>
            {g.label && <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{g.label}</p>}
            <ul>
              {g.itens.map((item) => {
                const ativo = estaAtivoPill(pathname, item.href, item.exato)
                const Icone = item.icone
                return (
                  <li key={item.href} className="flex items-center gap-1.5">
                    <Link
                      href={item.href}
                      onClick={() => setAberto(false)}
                      aria-current={ativo ? 'page' : undefined}
                      className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
                        ativo ? 'bg-brand/20 text-foreground' : 'text-foreground active:bg-foreground/[.06]'
                      }`}
                    >
                      <Icone className={`h-5 w-5 shrink-0 ${ativo ? 'text-brand' : 'text-muted'}`} strokeWidth={ativo ? 2.5 : 2} />
                      <span className="truncate">{item.label}</span>
                      {(item.aviso ?? 0) > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] leading-5 font-bold text-black">{item.aviso}</span>}
                    </Link>
                    {item.atalhos?.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        onClick={() => setAberto(false)}
                        className="flex h-9 shrink-0 items-center rounded-full border border-border-subtle px-3 text-xs font-medium text-muted active:bg-foreground/[.06]"
                      >
                        {a.label}
                      </Link>
                    ))}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </FolhaInferior>
    </div>
  )
}
