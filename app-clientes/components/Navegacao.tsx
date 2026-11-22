'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Dumbbell, House, TrendingUp } from 'lucide-react'

const ITENS = [
  { href: '/', rotulo: 'Início', Icone: House },
  { href: '/aulas', rotulo: 'Aulas', Icone: CalendarDays },
  { href: '/treinos', rotulo: 'Treinos', Icone: Dumbbell },
  { href: '/progresso', rotulo: 'Progresso', Icone: TrendingUp },
]

export default function Navegacao() {
  const caminho = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ITENS.map(({ href, rotulo, Icone }) => {
          const ativo = href === '/' ? caminho === '/' : caminho.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${ativo ? 'text-zinc-900' : 'text-zinc-400'}`}
                aria-current={ativo ? 'page' : undefined}
              >
                <Icone className="h-6 w-6" strokeWidth={ativo ? 2.4 : 1.8} />
                {rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
