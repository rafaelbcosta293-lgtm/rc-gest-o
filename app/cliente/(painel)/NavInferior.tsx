'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITENS = [
  { href: '/cliente', label: 'Início', icone: '🏠' },
  { href: '/cliente/avaliacoes', label: 'Avaliações', icone: '📊' },
  { href: '/cliente/mensalidade', label: 'Mensalidade', icone: '💳' },
  { href: '/cliente/mais', label: 'Mais', icone: '☰' },
]

export default function NavInferior() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITENS.map((item) => {
          const ativo =
            item.href === '/cliente' ? pathname === '/cliente' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                ativo ? 'text-black dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-600'
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                {item.icone}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
