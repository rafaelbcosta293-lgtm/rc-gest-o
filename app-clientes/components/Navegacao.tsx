'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Dumbbell, House, MonitorPlay, TrendingUp } from 'lucide-react'

const ITENS = [
  { href: '/', rotulo: 'Início', Icone: House },
  { href: '/aulas', rotulo: 'Aulas', Icone: CalendarDays },
  { href: '/videos', rotulo: 'Vídeos', Icone: MonitorPlay, soComVideos: true },
  { href: '/treinos', rotulo: 'Treinos', Icone: Dumbbell },
  { href: '/progresso', rotulo: 'Progresso', Icone: TrendingUp },
]

// Barra de navegação fixa ao fundo, ao alcance do polegar. O separador
// "Vídeos" só aparece a quem tem o serviço Aulas Virtuais.
export default function Navegacao({ comVideos = false }: { comVideos?: boolean }) {
  const caminho = usePathname()
  const itens = ITENS.filter((i) => !i.soComVideos || comVideos)
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className={`mx-auto grid max-w-lg px-2 ${itens.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {itens.map(({ href, rotulo, Icone }) => {
          const ativo = href === '/' ? caminho === '/' : caminho.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 pt-2 pb-2 text-[0.7rem] font-semibold transition-colors ${ativo ? 'text-foreground' : 'text-zinc-400'}`}
              >
                <span className={`flex h-8 items-center ${itens.length === 5 ? 'w-12' : 'w-14'} justify-center rounded-full transition-colors ${ativo ? 'bg-zinc-900 text-brand' : ''}`}>
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
