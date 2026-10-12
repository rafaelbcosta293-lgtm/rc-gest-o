import { redirect } from 'next/navigation'
import { getSessaoCliente } from '@/lib/data/sessaoCliente'
import { sairCliente } from './actions'
import NavInferior from './NavInferior'

export default async function PainelClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, cliente } = await getSessaoCliente()

  if (!userId) {
    redirect('/cliente/entrar')
  }

  if (!cliente) {
    // Sessão válida, mas sem ficha de cliente ligada — ex.: uma conta
    // da equipa a tentar entrar aqui por engano. Mostra um erro claro
    // em vez de rebentar a tentar ler dados que não existem.
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 text-center dark:bg-black">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Esta conta não está ligada a nenhuma ficha de cliente.
          <br />
          Contacta o ginásio se achas que isto está errado.
        </p>
        <form action={sairCliente} className="mt-4">
          <button
            type="submit"
            className="text-sm font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Sair
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RC Private Fitness Studio" className="h-7 w-auto" />
        <form action={sairCliente}>
          <button
            type="submit"
            className="text-xs font-medium text-zinc-500 underline dark:text-zinc-400"
          >
            Sair
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 pb-24 pt-6">
        <div className="mx-auto max-w-md">{children}</div>
      </main>

      <NavInferior />
    </div>
  )
}
