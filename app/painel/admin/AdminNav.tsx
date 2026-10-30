'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Home,
  CalendarRange,
  Activity,
  FileText,
  Wallet,
  Calculator,
  Package,
  History,
  KeyRound,
} from 'lucide-react'
import PillNavLink from '@/components/PillNavLink'

// Os ícones têm de ser resolvidos aqui dentro (componente cliente),
// nunca recebidos como prop vindos do layout (componente servidor) —
// um componente de ícone é uma função, e uma função não pode atravessar
// a fronteira servidor→cliente como prop, só dados simples podem.
//
// "filtravel" marca as pastas que mostram dados lado a lado dos dois
// estúdios — só essas ganham o submenu "só Fátima/só Leiria" ao passar
// o rato. Clicar no nome da pasta continua a abrir sempre os dois.
const PASTAS = [
  { href: '/painel/admin', label: 'Resumo', icone: Home, exato: true, filtravel: false },
  { href: '/painel/admin/este-mes', label: 'Este mês', icone: CalendarRange, filtravel: true },
  { href: '/painel/admin/agora', label: 'Agora', icone: Activity, filtravel: true },
  { href: '/painel/admin/relatorio', label: 'Relatório', icone: FileText, filtravel: true },
  { href: '/painel/admin/financeiro', label: 'Financeiro', icone: Wallet, filtravel: true },
  { href: '/painel/admin/simulador', label: 'Simulador', icone: Calculator, filtravel: false },
  { href: '/painel/admin/servicos', label: 'Serviços', icone: Package, filtravel: false },
  { href: '/painel/admin/auditoria', label: 'Auditoria', icone: History, filtravel: false },
  { href: '/painel/admin/contas', label: 'Contas', icone: KeyRound, filtravel: true },
]

const ESTUDIOS = [
  { slug: 'fatima', nome: 'Fátima' },
  { slug: 'leiria', nome: 'Leiria' },
]

export default function AdminNav() {
  // O submenu já não usa :hover em CSS puro (group-hover) — a barra tem
  // overflow-x-auto para caber em ecrãs estreitos, e isso obriga o
  // browser a cortar também o eixo vertical (regra do CSS: um eixo que
  // não seja "visible" força o outro a "auto"), escondendo o submenu por
  // baixo. Em vez disso o submenu é desenhado fora da barra, num portal
  // para o body, posicionado a partir da posição real da pasta.
  const [aberto, setAberto] = useState<string | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function abrir(href: string, el: HTMLElement) {
    if (fecharRef.current) clearTimeout(fecharRef.current)
    const rect = el.getBoundingClientRect()
    setPos({ left: rect.left + rect.width / 2, top: rect.bottom + 4 })
    setAberto(href)
  }

  function agendarFechar() {
    fecharRef.current = setTimeout(() => setAberto(null), 150)
  }

  function manterAberto() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
  }

  const pastaAberta = PASTAS.find((p) => p.href === aberto)

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
      {PASTAS.map((p) =>
        p.filtravel ? (
          <div
            key={p.href}
            className="shrink-0"
            onMouseEnter={(e) => abrir(p.href, e.currentTarget)}
            onMouseLeave={agendarFechar}
          >
            <PillNavLink href={p.href} label={p.label} icone={p.icone} exato={p.exato} destaque />
          </div>
        ) : (
          <PillNavLink key={p.href} href={p.href} label={p.label} icone={p.icone} exato={p.exato} destaque />
        )
      )}

      {pastaAberta &&
        pos &&
        createPortal(
          <div
            onMouseEnter={manterAberto}
            onMouseLeave={agendarFechar}
            className="fixed z-50 -translate-x-1/2"
            style={{ left: pos.left, top: pos.top }}
          >
            <div className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface p-1 shadow-pop">
              {ESTUDIOS.map((e) => (
                <Link
                  key={e.slug}
                  href={`${pastaAberta.href}?estudio=${e.slug}`}
                  onClick={() => setAberto(null)}
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs font-medium text-foreground/80 transition-colors hover:bg-brand/[.08] hover:text-foreground"
                >
                  {e.nome}
                </Link>
              ))}
            </div>
          </div>,
          document.body
        )}
    </nav>
  )
}
