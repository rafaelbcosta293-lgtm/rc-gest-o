import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from './login/actions'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import SubmitButton from '@/components/SubmitButton'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  // Quem tem acesso à Administração salta a grelha de módulos e vai
  // direto para lá, já combinada para todos os estúdios.
  let destino = '/painel'
  if (user) {
    const sessao = await getSessaoAtual()
    if (podeAcederAdmin(sessao.email)) {
      destino = '/painel/admin'
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="RC Private Fitness Studio" className="h-14 w-auto" />

      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-zinc-600 dark:text-zinc-400">
            Sessão iniciada como <strong>{user.email}</strong>
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={destino}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
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
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
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
