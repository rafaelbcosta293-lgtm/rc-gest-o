'use client'

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
import PillNavLink from '@/components/PillNavLink'

// Os ícones têm de ser resolvidos aqui dentro (componente cliente),
// nunca recebidos como prop vindos do layout (componente servidor) —
// um componente de ícone é uma função, e uma função não pode atravessar
// a fronteira servidor→cliente como prop, só dados simples podem.
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

export default function CoordenacaoNav() {
  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {PASTAS.map((p) => (
        <PillNavLink key={p.href} href={p.href} label={p.label} icone={p.icone} exato={p.exato} />
      ))}
    </nav>
  )
}
