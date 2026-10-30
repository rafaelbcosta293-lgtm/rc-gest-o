import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Home,
  KeyRound,
  CalendarCheck2,
  Clock,
  AlertTriangle,
  AlarmClock,
  Megaphone,
  History,
} from 'lucide-react'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederCoordenacao } from '@/lib/data/acessos'
import PillNavLink from '@/components/PillNavLink'

const PASTAS = [
  { href: '/painel/coordenacao', label: 'Resumo', icone: Home, exato: true },
  { href: '/painel/coordenacao/checklist', label: 'Checklist', icone: KeyRound },
  { href: '/painel/coordenacao/sessoes-experimentais', label: 'Sessões experimentais', icone: CalendarCheck2 },
  { href: '/painel/coordenacao/horas-equipa', label: 'Horas da equipa', icone: Clock },
  { href: '/painel/coordenacao/pendencias', label: 'Pendências', icone: AlertTriangle },
  { href: '/painel/coordenacao/horarios', label: 'Horários', icone: AlarmClock },
  { href: '/painel/coordenacao/marketing', label: 'Marketing', icone: Megaphone },
  { href: '/painel/coordenacao/timeline', label: 'Timeline', icone: History },
]

// Coordenação é só para o dono e para a conta geral do negócio —
// verificado por email antes de sequer chegar à password partilhada da
// área (essa é uma segunda camada opcional, esta é obrigatória).
export default async function CoordenacaoLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoAtual()

  if (!podeAcederCoordenacao(sessao.email)) {
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
