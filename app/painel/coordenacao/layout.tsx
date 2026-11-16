import { Suspense } from 'react'
import Link from '@/components/LinkRapido'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederCoordenacao } from '@/lib/data/acessos'
import { obterEstadosBanner } from '@/lib/data/smsGateway'
import { listarContactosAgendados } from '@/lib/data/contactosAgendados'
import BarraSmsGatewayOffline from '@/components/BarraSmsGatewayOffline'
import AlertaContactosAgendados from '@/components/AlertaContactosAgendados'
import AvisosHorario from '@/components/AvisosHorario'
import CoordenacaoNav from './CoordenacaoNav'
import { contarTarefasUrgentes } from '@/lib/data/tarefas'
import { hojeEmLisboa } from '@/lib/data/hoje'

// Coordenação é só para o dono e para a conta geral do negócio —
// verificado por email antes de sequer chegar à password partilhada da
// área (essa é uma segunda camada opcional, esta é obrigatória).
export default async function CoordenacaoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [sessao, estadosBanner, contactosAgendados, tarefasUrgentes] = await Promise.all([
    getSessaoAtual(),
    obterEstadosBanner(supabase),
    listarContactosAgendados(supabase),
    contarTarefasUrgentes(supabase, hojeEmLisboa()),
  ])

  if (!podeAcederCoordenacao(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Faixa + barra num único wrapper sticky — ver nota equivalente
          em app/painel/[estudio]/layout.tsx. */}
      <div className="sticky top-0 z-10 flex flex-col">
        <BarraSmsGatewayOffline estadosIniciais={estadosBanner} />
        <AlertaContactosAgendados contactosIniciais={contactosAgendados} />
        {/* Em Suspense: o aviso tem a sua própria consulta e, sem isto, a
            página inteira só era enviada depois de ela responder. Assim a
            página sai logo e o aviso entra quando chegar. */}
        <Suspense fallback={null}>
          <AvisosHorario supabase={supabase} userId={sessao.userId} email={sessao.email} />
        </Suspense>
        <header className="dark tema-proprio shadow-deep flex items-center gap-3 border-b border-border-subtle bg-surface/80 px-4 py-2.5 backdrop-blur-xl">
          <Link href="/painel" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-8 w-auto" priority />
          </Link>
          <CoordenacaoNav tarefasUrgentes={tarefasUrgentes} />
        </header>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
