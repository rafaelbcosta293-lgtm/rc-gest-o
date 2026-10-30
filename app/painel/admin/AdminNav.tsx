'use client'

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
  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {PASTAS.map((p) =>
        p.filtravel ? (
          <div key={p.href} className="group/pasta relative shrink-0">
            <PillNavLink href={p.href} label={p.label} icone={p.icone} exato={p.exato} />
            <div className="invisible absolute left-1/2 top-full z-30 -translate-x-1/2 pt-1 opacity-0 transition-opacity group-hover/pasta:visible group-hover/pasta:opacity-100">
              <div className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface p-1 shadow-pop">
                {ESTUDIOS.map((e) => (
                  <Link
                    key={e.slug}
                    href={`${p.href}?estudio=${e.slug}`}
                    className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs font-medium text-foreground/80 transition-colors hover:bg-brand/[.08] hover:text-foreground"
                  >
                    Só {e.nome}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <PillNavLink key={p.href} href={p.href} label={p.label} icone={p.icone} exato={p.exato} />
        )
      )}
    </nav>
  )
}
