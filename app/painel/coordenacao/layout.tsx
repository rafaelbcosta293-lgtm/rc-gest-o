import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederCoordenacao } from '@/lib/data/acessos'
import { obterEstadoBanner } from '@/lib/data/lembretesSms'
import BarraSmsGatewayOffline from '@/components/BarraSmsGatewayOffline'
import CoordenacaoNav from './CoordenacaoNav'

// Coordenação é só para o dono e para a conta geral do negócio —
// verificado por email antes de sequer chegar à password partilhada da
// área (essa é uma segunda camada opcional, esta é obrigatória).
export default async function CoordenacaoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [sessao, estadoBanner] = await Promise.all([getSessaoAtual(), obterEstadoBanner(supabase)])

  if (!podeAcederCoordenacao(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Faixa + barra num único wrapper sticky — ver nota equivalente
          em app/painel/[estudio]/layout.tsx. */}
      <div className="sticky top-0 z-10 flex flex-col">
        <BarraSmsGatewayOffline offlineInicial={estadoBanner.offline} desdeInicial={estadoBanner.desde} />
        <header className="shadow-deep flex items-center gap-3 border-b border-border-subtle bg-surface/80 px-4 py-2.5 backdrop-blur-xl">
          <Link href="/painel" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-8 w-auto" priority />
          </Link>
          <CoordenacaoNav />
        </header>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
