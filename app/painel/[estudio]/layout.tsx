import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftRight } from 'lucide-react'
import { MODULOS } from '@/lib/data/constantes'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { podeAcederEstudio } from '@/lib/data/acessos'
import { NavLinkDesktop, NavLinkTablet, NavLinkPhone } from './NavLink'

export default async function EstudioLayout({ children, params }: LayoutProps<'/painel/[estudio]'>) {
  const { estudio: slug } = await params

  const sessao = await getSessaoAtual()

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
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Telemóvel (<768px): mini-barra no topo, só para trocar de
          estúdio — os módulos ficam na barra de separadores do fundo,
          sempre ao alcance do polegar, ao estilo iOS. */}
      <div className="sticky top-0 z-10 flex items-center justify-end border-b border-border-subtle bg-background/80 px-4 py-2 backdrop-blur-xl md:hidden">
        <Link
          href="/painel"
          title="Mudar estúdio"
          aria-label="Mudar estúdio"
          className="flex items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
        >
          <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </Link>
      </div>

      {/* Tablet (768–1023px): barra lateral estreita, só com ícones —
          mantém a navegação sempre visível sem ocupar tanto ecrã como a
          versão completa. */}
      <aside className="hidden border-border-subtle bg-surface/70 backdrop-blur-xl md:sticky md:top-0 md:flex md:h-screen md:w-20 md:flex-col md:items-center md:gap-1 md:border-r md:py-5 lg:hidden">
        <Link href="/painel" className="mb-3 flex items-center justify-center p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="RC Private Fitness Studio" className="h-7 w-auto" />
        </Link>
        {MODULOS.map((m) =>
          podeAceder(m) ? (
            <NavLinkTablet key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} nome={m.nome} />
          ) : (
            <span
              key={m.id}
              title={tituloBloqueado(m)}
              className="flex cursor-not-allowed items-center justify-center rounded-xl p-3 text-muted opacity-40"
            >
              <m.icone className="h-5 w-5" strokeWidth={2.25} />
            </span>
          )
        )}
      </aside>

      {/* Computador (≥1024px): barra lateral completa, com nomes por
          extenso. */}
      <aside className="hidden shrink-0 border-border-subtle bg-surface/70 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-r">
        <Link href="/painel" className="flex items-center px-6 py-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="RC Private Fitness Studio" className="h-10 w-auto" />
        </Link>
        <nav className="flex flex-col gap-1 px-4">
          {MODULOS.map((m) =>
            podeAceder(m) ? (
              <NavLinkDesktop key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} nome={m.nome} />
            ) : (
              <span
                key={m.id}
                title={tituloBloqueado(m)}
                className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted opacity-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-border-subtle">
                  <m.icone className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                {m.nome}
              </span>
            )
          )}
        </nav>
      </aside>

      {/* O conteúdo ganha espaço extra no fundo, no telemóvel, para a
          barra de separadores fixa não tapar o fim da página. */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>

      {/* Telemóvel: barra de separadores fixa no fundo, ao estilo iOS. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around overflow-x-auto border-t border-border-subtle bg-background/80 px-1 py-1 shadow-[0_-8px_24px_rgba(24,24,27,0.06)] backdrop-blur-xl md:hidden">
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
