import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { corEstudio } from '@/lib/data/constantes'
import { podeAcederAdmin, podeAcederCoordenacao, podeAcederEstudio } from '@/lib/data/acessos'

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await createClient()

  const [{ data: userData }, estudios, { data: clientes }] = await Promise.all([
    supabase.auth.getUser(),
    getEstudios(supabase),
    supabase.from('clientes').select('estudio_id, estado'),
  ])

  if (!userData.user) {
    redirect('/login')
  }

  const email = userData.user.email ?? null
  const estudiosVisiveis = estudios.filter((e) => podeAcederEstudio(email, e.slug))
  const temCoordenacao = podeAcederCoordenacao(email)
  const temAdmin = podeAcederAdmin(email)

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

      {erro === 'sem-acesso' && (
        <p className="w-full max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          A tua conta não tem acesso a essa área.
        </p>
      )}

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {estudiosVisiveis.map((e) => {
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

        {temCoordenacao && (
          <Link
            href="/painel/coordenacao"
            className="rounded-2xl border border-black/10 bg-white p-6 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="block h-1.5 w-10 rounded-full bg-[#1F6FB2]" />
            <h2 className="mt-4 text-2xl font-semibold text-black dark:text-zinc-50">
              Coordenação
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Fátima e Leiria, na mesma página.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Entrar →
            </span>
          </Link>
        )}
        {temAdmin && (
          <Link
            href="/painel/admin"
            className="rounded-2xl border border-black/10 bg-white p-6 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="block h-1.5 w-10 rounded-full bg-[#5B3FA0]" />
            <h2 className="mt-4 text-2xl font-semibold text-black dark:text-zinc-50">
              Administração
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Fátima e Leiria, na mesma página.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Entrar →
            </span>
          </Link>
        )}
      </div>

      {estudios.length === 0 && (
        <p className="text-sm text-zinc-500">
          Ainda não há nenhum estúdio configurado na base de dados.
        </p>
      )}
      {estudios.length > 0 && estudiosVisiveis.length === 0 && !temCoordenacao && !temAdmin && (
        <p className="max-w-md text-center text-sm text-zinc-500">
          A tua conta ainda não tem acesso a nenhuma área desta app. Contacta a administração.
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
