import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { EMAIL_POR_ESTUDIO } from '@/lib/data/acessos'
import { definirPasswordEstudio } from './actions'
import SubmitButton from '@/components/SubmitButton'
import PasswordInput from '@/components/PasswordInput'

export default async function ContasEstudiosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sucesso?: string }>
}) {
  const { error, sucesso } = await searchParams
  const supabase = await createClient()
  const estudios = await getEstudios(supabase)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel/admin" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Contas de login dos estúdios
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Cada estúdio tem uma conta de email própria, partilhada pela equipa — separada das fichas
        dos instrutores. Define aqui uma nova palavra-passe se for preciso.
      </p>

      {sucesso && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          Palavra-passe atualizada.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {estudios.map((estudio) => {
          const email = EMAIL_POR_ESTUDIO[estudio.slug]
          if (!email) return null
          return (
            <div
              key={estudio.id}
              className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
            >
              <h2 className="font-semibold text-black dark:text-zinc-50">{estudio.nome}</h2>
              <p className="mt-0.5 font-mono text-xs text-zinc-500">{email}</p>
              <form action={definirPasswordEstudio} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="email" value={email} />
                <PasswordInput
                  id={`password-${estudio.slug}`}
                  name="password"
                  label="Nova palavra-passe"
                  autoComplete="new-password"
                  minLength={6}
                />
                <PasswordInput
                  id={`confirmPassword-${estudio.slug}`}
                  name="confirmPassword"
                  label="Confirmar palavra-passe"
                  autoComplete="new-password"
                  minLength={6}
                />
                <SubmitButton
                  pendingText="A guardar…"
                  className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
                >
                  Guardar palavra-passe
                </SubmitButton>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
