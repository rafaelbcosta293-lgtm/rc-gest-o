'use client'

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
const PASTAS = [
  { href: '/painel/admin', label: 'Resumo', icone: Home, exato: true },
  { href: '/painel/admin/este-mes', label: 'Este mês', icone: CalendarRange },
  { href: '/painel/admin/agora', label: 'Agora', icone: Activity },
  { href: '/painel/admin/relatorio', label: 'Relatório', icone: FileText },
  { href: '/painel/admin/financeiro', label: 'Financeiro', icone: Wallet },
  { href: '/painel/admin/simulador', label: 'Simulador', icone: Calculator },
  { href: '/painel/admin/servicos', label: 'Serviços', icone: Package },
  { href: '/painel/admin/auditoria', label: 'Auditoria', icone: History },
  { href: '/painel/admin/contas', label: 'Contas', icone: KeyRound },
]

export default function AdminNav() {
  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {PASTAS.map((p) => (
        <PillNavLink key={p.href} href={p.href} label={p.label} icone={p.icone} exato={p.exato} />
      ))}
    </nav>
  )
}
