import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederCoordenacao } from '@/lib/data/acessos'
import CoordenacaoNav from './CoordenacaoNav'

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
        <CoordenacaoNav />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
