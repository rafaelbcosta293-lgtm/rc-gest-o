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

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-black/10 bg-background dark:border-white/10">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-4 py-2">
          <Link
            href="/painel"
            title="Início"
            aria-label="Início"
            className="rounded-md px-2 py-1.5 text-lg hover:bg-black/[.04] dark:hover:bg-white/[.08]"
          >
            🏠
          </Link>
          <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          {MODULOS.map((m) =>
            m.pronto && (!m.restrito || ehAdmin) ? (
              <Link
                key={m.id}
                href={`/painel/${slug}/${m.id}`}
                title={m.nome}
                aria-label={m.nome}
                className="rounded-md px-2 py-1.5 text-lg hover:bg-black/[.04] dark:hover:bg-white/[.08]"
              >
                {m.icone}
              </Link>
            ) : (
              <span
                key={m.id}
                title={m.pronto ? `${m.nome} — só para administradores` : `${m.nome} — brevemente`}
                aria-label={m.pronto ? `${m.nome} (só para administradores)` : `${m.nome} (brevemente)`}
                className="cursor-not-allowed rounded-md px-2 py-1.5 text-lg opacity-30"
              >
                {m.icone}
              </span>
            )
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
