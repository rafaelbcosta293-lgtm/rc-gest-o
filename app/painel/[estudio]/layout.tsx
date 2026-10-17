import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Home } from 'lucide-react'
import { MODULOS } from '@/lib/data/constantes'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { podeAcederEstudio } from '@/lib/data/acessos'
import { NavLinkDesktop, NavLinkMobile } from './NavLink'

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
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Telemóvel/tablet: barra fixa no topo, só com ícones */}
      <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-border-subtle bg-background px-4 py-2 md:hidden">
        <Link
          href="/painel"
          title="Início"
          aria-label="Início"
          className="flex shrink-0 items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
        >
          <Home className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </Link>
        <span className="mx-1 h-5 w-px shrink-0 bg-border-subtle" />
        {MODULOS.map((m) =>
          podeAceder(m) ? (
            <NavLinkMobile key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} nome={m.nome} />
          ) : (
            <span
              key={m.id}
              title={tituloBloqueado(m)}
              aria-label={tituloBloqueado(m)}
              className="flex shrink-0 cursor-not-allowed items-center justify-center rounded-full p-2 text-muted opacity-40"
            >
              <m.icone className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
          )
        )}
      </div>

      {/* Computador: menu lateral fixo, com nomes por extenso */}
      <aside className="hidden shrink-0 border-border-subtle md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-r">
        <Link href="/painel" className="flex items-center px-5 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="RC Private Fitness Studio" className="h-10 w-auto" />
        </Link>
        <nav className="flex flex-col gap-0.5 px-3">
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

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
