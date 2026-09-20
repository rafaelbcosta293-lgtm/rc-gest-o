import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ESTUDIOS } from '@/lib/data/constantes'

export default async function PainelPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    redirect('/login')
  }

  const { data: clientes } = await supabase
    .from('clientes')
    .select('estudio, estado')

  const contagem = (estudio: string) =>
    (clientes ?? []).filter((c) => c.estudio === estudio && c.estado === 'Ativo').length

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
          Em que estúdio estás?
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sessão iniciada como {userData.user.email}
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {ESTUDIOS.map((e) => (
          <Link
            key={e.id}
            href={`/painel/${e.id}`}
            className="rounded-2xl border border-black/10 bg-white p-6 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
          >
            <span
              className="block h-1.5 w-10 rounded-full"
              style={{ background: e.cor }}
            />
            <h2 className="mt-4 text-2xl font-semibold text-black dark:text-zinc-50">
              {e.nome}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {contagem(e.id)} {contagem(e.id) === 1 ? 'cliente ativo' : 'clientes ativos'}
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Entrar →
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/"
        className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
