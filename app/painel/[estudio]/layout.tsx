import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, Search } from 'lucide-react'
import { MODULOS } from '@/lib/data/constantes'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { podeAcederEstudio } from '@/lib/data/acessos'
import { obterEstadosBanner } from '@/lib/data/lembretesSms'
import BarraSmsGatewayOffline from '@/components/BarraSmsGatewayOffline'
import { NavLinkTopBar, NavLinkPhone } from './NavLink'

export default async function EstudioLayout({ children, params }: LayoutProps<'/painel/[estudio]'>) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const [sessao, estadosBanner] = await Promise.all([getSessaoAtual(), obterEstadosBanner(supabase)])

  // O acesso a cada estúdio é por email, não por "papel" — só quem está
  // na lista de lib/data/acessos.ts entra aqui, independentemente do que
  // a ficha em "perfis" diz.
  if (!podeAcederEstudio(sessao.email, slug)) {
    redirect('/painel?erro=sem-acesso')
  }

  const { ehAdmin, ehGestao } = papeisDaSessao(sessao)

  const podeAceder = (m: (typeof MODULOS)[number]) =>
    m.pronto && (!m.restrito || (m.restrito === 'admin' ? ehAdmin : ehGestao))
  const tituloBloqueado = (m: (typeof MODULOS)[number]) =>
    !m.pronto
      ? `${m.nome} — brevemente`
      : `${m.nome} — só para ${m.restrito === 'admin' ? 'administradores' : 'gestão'}`

  return (
    <div className="flex min-h-full flex-col">
      {/* A faixa e as barras de topo partilham um único wrapper
          "sticky" — cada uma sticky à parte faria a barra tapar a
          faixa ao fazer scroll (duas sticky top-0 ocupam o mesmo
          lugar; só uma, com ambas dentro, as mantém empilhadas). */}
      <div className="sticky top-0 z-10 flex flex-col">
        <BarraSmsGatewayOffline estadosIniciais={estadosBanner} apenasEstudio={slug} />

        {/* Telemóvel (<768px): mini-barra no topo, só para trocar de
            estúdio — os módulos ficam na barra de separadores do fundo,
            sempre ao alcance do polegar, ao estilo iOS. */}
        <div className="shadow-deep flex items-center justify-end gap-1 border-b border-border-subtle bg-background/90 px-4 py-2 backdrop-blur-xl md:hidden">
          <Link
            href={`/painel/${slug}/pesquisa`}
            title="Pesquisar"
            aria-label="Pesquisar"
            className="flex items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
          <Link
            href="/painel"
            title="Mudar estúdio"
            aria-label="Mudar estúdio"
            className="flex items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
          >
            <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
        </div>

        {/* Computador/tablet (≥768px): barra superior fixa, com o
            logótipo, os módulos (pílulas, numa linha com scroll
            horizontal se não couberem) e as ações à direita. */}
        <header className="shadow-deep hidden items-center gap-3 border-b border-border-subtle bg-surface/80 px-4 py-2.5 backdrop-blur-xl md:flex">
          <Link href="/painel" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-8 w-auto" priority />
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {MODULOS.map((m) =>
              podeAceder(m) ? (
                <NavLinkTopBar key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} nome={m.nome} />
              ) : (
                <span
                  key={m.id}
                  title={tituloBloqueado(m)}
                  className="flex shrink-0 cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-full border border-border-subtle px-3.5 py-2 text-sm font-bold tracking-wide text-muted opacity-40"
                >
                  <m.icone className="h-4 w-4" strokeWidth={2.5} />
                  {m.nome}
                </span>
              )
            )}
          </nav>
          <Link
            href={`/painel/${slug}/pesquisa`}
            title="Pesquisar"
            aria-label="Pesquisar"
            className="flex shrink-0 items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
          <Link
            href="/painel"
            title="Mudar estúdio"
            aria-label="Mudar estúdio"
            className="flex shrink-0 items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
          >
            <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
        </header>
      </div>

      {/* O conteúdo ganha espaço extra no fundo, no telemóvel, para a
          barra de separadores fixa não tapar o fim da página. */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>

      {/* Telemóvel: barra de separadores fixa no fundo, ao estilo iOS. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around overflow-x-auto border-t border-border-subtle bg-background/90 px-1 py-1 shadow-[0_-2px_2px_rgba(24,24,27,0.05),0_-16px_32px_-8px_rgba(24,24,27,0.16)] backdrop-blur-xl md:hidden">
        {MODULOS.map((m) =>
          podeAceder(m) ? (
            <NavLinkPhone key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} />
          ) : (
            <span
              key={m.id}
              title={tituloBloqueado(m)}
              className="flex min-w-14 shrink-0 cursor-not-allowed flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-muted opacity-40"
            >
              <m.icone className="h-[22px] w-[22px]" strokeWidth={2} />
              <span className="text-[10px] font-medium">{m.curto ?? m.nome}</span>
            </span>
          )
        )}
      </nav>
    </div>
  )
}
