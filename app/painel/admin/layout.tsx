import { Suspense } from 'react'
import Link from '@/components/LinkRapido'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import { obterEstadosBanner } from '@/lib/data/smsGateway'
import { listarContactosAgendados } from '@/lib/data/contactosAgendados'
import BarraSmsGatewayOffline from '@/components/BarraSmsGatewayOffline'
import AlertaContactosAgendados from '@/components/AlertaContactosAgendados'
import AlertaDespesas from '@/components/AlertaDespesas'
import { hojeEmLisboa, listarAvisosDespesas } from '@/lib/data/despesas'
import AvisosHorario from '@/components/AvisosHorario'
import { contarLembretesPorTratar } from '@/lib/data/lembretes'
import AdminNav from './AdminNav'

// Administração é só para o dono da app — verificado por email antes de
// sequer chegar à password partilhada da área (essa é uma segunda
// camada opcional, esta é obrigatória).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const [sessao, estadosBanner, contactosAgendados, avisosDespesas, { count: pendentesFaturas }, lembretesPorTratar] = await Promise.all([
    getSessaoAtual(),
    obterEstadosBanner(supabase),
    listarContactosAgendados(supabase),
    listarAvisosDespesas(supabase, hoje),
    supabase
      .from('pedidos_fatura')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendente', 'erro', 'a_emitir']),
    contarLembretesPorTratar(supabase, hoje),
  ])

  if (!podeAcederAdmin(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return (
    // "dark" fica só aqui — a Administração é a única zona da app com o
    // tema escuro/"tech"; o resto continua no modelo claro/vidro.
    // "campos-claros": todas as caixas de texto da área ficam brancas,
    // para se destacarem do fundo preto (ver app/globals.css).
    <div className="dark tema-proprio campos-claros flex min-h-full flex-col">
      {/* Faixa + barra num único wrapper sticky — ver nota equivalente
          em app/painel/[estudio]/layout.tsx. */}
      <div className="sticky top-0 z-10 flex flex-col">
        <BarraSmsGatewayOffline estadosIniciais={estadosBanner} />
        <AlertaContactosAgendados contactosIniciais={contactosAgendados} />
        <AlertaDespesas avisos={avisosDespesas} />
        {/* Em Suspense: o aviso tem a sua própria consulta e, sem isto, a
            página inteira só era enviada depois de ela responder. Assim a
            página sai logo e o aviso entra quando chegar. */}
        <Suspense fallback={null}>
          <AvisosHorario supabase={supabase} userId={sessao.userId} email={sessao.email} />
        </Suspense>
        <header className="shadow-deep flex items-center gap-3 border-b border-border-subtle bg-surface/80 px-4 py-3 backdrop-blur-xl">
          <Link href="/painel" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-9 w-auto" priority />
          </Link>
          <AdminNav pendentesFaturas={pendentesFaturas ?? 0} despesasAPagar={avisosDespesas.length} lembretesPorTratar={lembretesPorTratar} />
        </header>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
