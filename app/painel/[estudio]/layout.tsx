import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MODULOS } from '@/lib/data/constantes'

export default async function EstudioLayout({ children, params }: LayoutProps<'/painel/[estudio]'>) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const { data: perfil } = userData.user
    ? await supabase.from('perfis').select('papel').eq('id', userData.user.id).maybeSingle()
    : { data: null }
  const ehAdmin = perfil?.papel === 'admin'

  const podeAceder = (m: (typeof MODULOS)[number]) => m.pronto && (!m.restrito || ehAdmin)
  const tituloBloqueado = (m: (typeof MODULOS)[number]) =>
    m.pronto ? `${m.nome} — só para administradores` : `${m.nome} — brevemente`

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Telemóvel/tablet: barra fixa no topo, só com ícones */}
      <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-black/10 bg-background px-4 py-2 md:hidden dark:border-white/10">
        <Link
          href="/painel"
          title="Início"
          aria-label="Início"
          className="shrink-0 rounded-md px-2 py-1.5 text-lg hover:bg-black/[.04] dark:hover:bg-white/[.08]"
        >
          🏠
        </Link>
        <span className="mx-1 h-5 w-px shrink-0 bg-black/10 dark:bg-white/10" />
        {MODULOS.map((m) =>
          podeAceder(m) ? (
            <Link
              key={m.id}
              href={`/painel/${slug}/${m.id}`}
              title={m.nome}
              aria-label={m.nome}
              className="shrink-0 rounded-md px-2 py-1.5 text-lg hover:bg-black/[.04] dark:hover:bg-white/[.08]"
            >
              {m.icone}
            </Link>
          ) : (
            <span
              key={m.id}
              title={tituloBloqueado(m)}
              aria-label={tituloBloqueado(m)}
              className="shrink-0 cursor-not-allowed rounded-md px-2 py-1.5 text-lg opacity-30"
            >
              {m.icone}
            </span>
          )
        )}
      </div>

      {/* Computador: menu lateral fixo, com nomes por extenso */}
      <aside className="hidden shrink-0 border-black/10 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-r dark:border-white/10">
        <Link href="/painel" className="flex items-center px-5 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="RC Private Fitness Studio" className="h-10 w-auto" />
        </Link>
        <nav className="flex flex-col gap-0.5 px-3">
          {MODULOS.map((m) =>
            podeAceder(m) ? (
              <Link
                key={m.id}
                href={`/painel/${slug}/${m.id}`}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.08]"
              >
                <span className="text-lg leading-none">{m.icone}</span> {m.nome}
              </Link>
            ) : (
              <span
                key={m.id}
                title={tituloBloqueado(m)}
                className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 opacity-60"
              >
                <span className="text-lg leading-none">{m.icone}</span> {m.nome}
              </span>
            )
          )}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
