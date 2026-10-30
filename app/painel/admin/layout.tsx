import Link from 'next/link'
import { redirect } from 'next/navigation'
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
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import PillNavLink from '@/components/PillNavLink'

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

// Administração é só para o dono da app — verificado por email antes de
// sequer chegar à password partilhada da área (essa é uma segunda
// camada opcional, esta é obrigatória).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoAtual()

  if (!podeAcederAdmin(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-surface/70 px-4 py-2.5 backdrop-blur-xl">
        <Link href="/painel" className="flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="RC Private Fitness Studio" className="h-8 w-auto" />
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {PASTAS.map((p) => (
            <PillNavLink key={p.href} href={p.href} label={p.label} icone={p.icone} exato={p.exato} />
          ))}
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
