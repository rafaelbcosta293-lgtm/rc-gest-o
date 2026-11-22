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
  ListTodo,
} from 'lucide-react'
import PillNavLink from '@/components/PillNavLink'
import BarraAjustavel from '@/components/BarraAjustavel'
import MenuTelemovel from '@/components/MenuTelemovel'

// Os ícones têm de ser resolvidos aqui dentro (componente cliente),
// nunca recebidos como prop vindos do layout (componente servidor) —
// um componente de ícone é uma função, e uma função não pode atravessar
// a fronteira servidor→cliente como prop, só dados simples podem.
const PASTAS = [
  { href: '/painel/coordenacao', label: 'Resumo', icone: Home, exato: true },
  { href: '/painel/coordenacao/tarefas', label: 'Tarefas', icone: ListTodo },
  { href: '/painel/coordenacao/checklist', label: 'Checklist', icone: KeyRound },
  { href: '/painel/coordenacao/sessoes-experimentais', label: 'Sessões experimentais', icone: CalendarCheck2 },
  { href: '/painel/coordenacao/horas-equipa', label: 'Horas da equipa', icone: Clock },
  { href: '/painel/coordenacao/pendencias', label: 'Pendências', icone: AlertTriangle },
  { href: '/painel/coordenacao/horarios', label: 'Horários', icone: AlarmClock },
  { href: '/painel/coordenacao/marketing', label: 'Marketing', icone: Megaphone },
  { href: '/painel/coordenacao/timeline', label: 'Timeline', icone: History },
]

// tarefasUrgentes: tarefas com o prazo passado ou para hoje.
export default function CoordenacaoNav({ tarefasUrgentes = 0 }: { tarefasUrgentes?: number }) {
  const avisoDe = (href: string) => (href === '/painel/coordenacao/tarefas' ? tarefasUrgentes : 0)
  return (
    <>
      <div className="hidden min-w-0 flex-1 md:flex">
        <BarraAjustavel className="min-w-0 flex-1" navClassName="flex items-center gap-2">
          {PASTAS.map((p) => (
            <PillNavLink key={p.href} href={p.href} label={p.label} icone={p.icone} exato={p.exato} aviso={avisoDe(p.href)} />
          ))}
        </BarraAjustavel>
      </div>
      {/* Telemóvel: a lista completa, com nomes, numa folha ao fundo do ecrã. */}
      <MenuTelemovel
        titulo="Coordenação"
        grupos={[{ itens: PASTAS.map((p) => ({ ...p, aviso: avisoDe(p.href) })) }]}
        className="flex md:hidden"
      />
    </>
  )
}
