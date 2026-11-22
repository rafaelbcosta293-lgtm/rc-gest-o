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

// Barra de navegação fixa ao fundo, ao alcance do polegar.
export default function Navegacao() {
  const caminho = usePathname()
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2">
        {ITENS.map(({ href, rotulo, Icone }) => {
          const ativo = href === '/' ? caminho === '/' : caminho.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 pt-2 pb-2 text-[0.7rem] font-semibold transition-colors ${ativo ? 'text-foreground' : 'text-zinc-400'}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${ativo ? 'bg-zinc-900 text-brand' : ''}`}>
                  <Icone className="h-[1.35rem] w-[1.35rem]" strokeWidth={ativo ? 2.2 : 1.9} />
                </span>
                {rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
