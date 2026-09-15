import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PainelPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  // Segunda verificação, independente do proxy: se por algum motivo
  // esta página for pedida sem passar pelo proxy (ex.: refactor futuro
  // do matcher), continua protegida.
  if (!data.user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Painel
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Bem-vindo, <strong>{data.user.email}</strong>. Esta página só é
        visível com sessão iniciada.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-zinc-950 underline dark:text-zinc-50"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
