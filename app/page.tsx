import Link from 'next/link'
import Image from 'next/image'
import { logout } from './login/actions'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import SubmitButton from '@/components/SubmitButton'

export default async function Home() {
  // getSessaoAtual() já faz o próprio supabase.auth.getUser() lá dentro
  // (e fica em cache() por pedido) — chamar getUser() aqui outra vez só
  // duplicava essa ida à Supabase Auth sem necessidade.
  const sessao = await getSessaoAtual()
  const emLogado = sessao.userId !== null

  // Quem tem acesso à Administração salta a grelha de módulos e vai
  // direto para lá, já combinada para todos os estúdios.
  const destino = emLogado && podeAcederAdmin(sessao.email) ? '/painel/admin' : '/painel'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-14 w-auto" />

      {emLogado ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-muted">
            Sessão iniciada como <strong>{sessao.email}</strong>
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={destino}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
            >
              Ir para o painel
            </Link>
            <form action={logout}>
              <SubmitButton
                pendingText="A terminar sessão…"
                className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-bold hover:bg-foreground/[.08]"
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
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
          >
            Iniciar sessão
          </Link>
          <Link
            href="/registo"
            className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-bold hover:bg-foreground/[.08]"
          >
            Criar conta
          </Link>
        </div>
      )}
    </div>
  )
}
