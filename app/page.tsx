import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from './login/actions'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { getEstudios } from '@/lib/data/estudios'
import SubmitButton from '@/components/SubmitButton'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  // Quem é admin salta a grelha de módulos e vai direto para a
  // Administração — do único estúdio, se só houver um.
  let destino = '/painel'
  if (user) {
    const sessao = await getSessaoAtual()
    const { ehAdmin } = papeisDaSessao(sessao)
    if (ehAdmin) {
      const estudios = await getEstudios(supabase)
      destino = estudios.length === 1 ? `/painel/${estudios[0].slug}/admin` : '/painel'
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        RC Gestão
      </h1>

      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-zinc-600 dark:text-zinc-400">
            Sessão iniciada como <strong>{user.email}</strong>
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={destino}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Ir para o painel
            </Link>
            <form action={logout}>
              <SubmitButton
                pendingText="A terminar sessão…"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
              >
                Terminar sessão
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Iniciar sessão
          </Link>
          <Link
            href="/registo"
            className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
          >
            Criar conta
          </Link>
        </div>
      )}
    </div>
  )
}
