import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { login } from './actions'
import SubmitButton from '@/components/SubmitButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data.user) {
    redirect('/')
  }

  const { error } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Iniciar sessão
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Entra com o teu email e palavra-passe.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4" action={login}>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Palavra-passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
            />
          </div>

          <SubmitButton
            pendingText="A entrar…"
            className="mt-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Entrar
          </SubmitButton>
        </form>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/recuperar-password"
            className="font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Esqueceste-te da palavra-passe?
          </Link>
        </p>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Ainda não tens conta?{' '}
          <Link
            href="/registo"
            className="font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
