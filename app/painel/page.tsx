import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { corEstudio } from '@/lib/data/constantes'

export default async function PainelPage() {
  const supabase = await createClient()

  const [{ data: userData }, estudios, { data: clientes }] = await Promise.all([
    supabase.auth.getUser(),
    getEstudios(supabase),
    supabase.from('clientes').select('estudio_id, estado'),
  ])

  if (!userData.user) {
    redirect('/login')
  }

  const contagem = (estudioId: number) =>
    (clientes ?? []).filter((c) => c.estudio_id === estudioId && c.estado === 'Ativo').length

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
        {estudios.map((e) => {
          const cor = corEstudio(e.slug)
          const n = contagem(e.id)
          return (
            <Link
              key={e.id}
              href={`/painel/${e.slug}`}
              className="rounded-2xl border border-black/10 bg-white p-6 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
            >
              <span
                className="block h-1.5 w-10 rounded-full"
                style={{ background: cor.cor }}
              />
              <h2 className="mt-4 text-2xl font-semibold text-black dark:text-zinc-50">
                {e.nome}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {n} {n === 1 ? 'cliente ativo' : 'clientes ativos'}
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-zinc-950 dark:text-zinc-50">
                Entrar →
              </span>
            </Link>
          )
        })}
      </div>

      {estudios.length === 0 && (
        <p className="text-sm text-zinc-500">
          Ainda não há nenhum estúdio configurado na base de dados.
        </p>
      )}

      <Link
        href="/"
        className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
