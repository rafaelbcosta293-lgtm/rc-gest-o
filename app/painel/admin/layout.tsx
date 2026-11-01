import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import { obterEstadosBanner } from '@/lib/data/smsGateway'
import BarraSmsGatewayOffline from '@/components/BarraSmsGatewayOffline'
import AdminNav from './AdminNav'

// Administração é só para o dono da app — verificado por email antes de
// sequer chegar à password partilhada da área (essa é uma segunda
// camada opcional, esta é obrigatória).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [sessao, estadosBanner] = await Promise.all([getSessaoAtual(), obterEstadosBanner(supabase)])

  if (!podeAcederAdmin(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return (
    // "dark" fica só aqui — a Administração é a única zona da app com o
    // tema escuro/"tech"; o resto continua no modelo claro/vidro.
    <div className="dark tema-proprio flex min-h-full flex-col">
      {/* Faixa + barra num único wrapper sticky — ver nota equivalente
          em app/painel/[estudio]/layout.tsx. */}
      <div className="sticky top-0 z-10 flex flex-col">
        <BarraSmsGatewayOffline estadosIniciais={estadosBanner} />
        <header className="shadow-deep flex items-center gap-3 border-b border-border-subtle bg-surface/80 px-4 py-3 backdrop-blur-xl">
          <Link href="/painel" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-9 w-auto" priority />
          </Link>
          <AdminNav />
        </header>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
