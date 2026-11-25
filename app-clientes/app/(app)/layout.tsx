import Link from 'next/link'
import Marca from '@/components/Marca'
import Navegacao from '@/components/Navegacao'
import { contaAtual } from '@/lib/dados'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const conta = await contaAtual()
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-30 bg-background pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" aria-label="Início">
            <Marca largura={84} />
          </Link>
          <Link
            href="/conta"
            aria-label="A minha conta"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-brand active:scale-95"
          >
            {conta.nome.trim().charAt(0).toUpperCase() || 'C'}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</main>
      <Navegacao comVideos={conta.aulas_virtuais} />
    </div>
  )
}
