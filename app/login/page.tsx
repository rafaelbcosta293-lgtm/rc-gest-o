import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { login } from './actions'
import SubmitButton from '@/components/SubmitButton'
import PasswordInput from '@/components/PasswordInput'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data.user) {
    redirect('/')
  }

  const { error, info } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border-subtle bg-surface p-8 shadow-card-hover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RC Private Fitness Studio" className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Iniciar sessão
        </h1>
        <p className="mt-1 text-sm text-muted">
          Entra com o teu email e palavra-passe.
        </p>

        {info && (
          <p className="mt-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            {info}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4" action={login}>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground/80"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand/60"
            />
          </div>

          <PasswordInput
            id="password"
            name="password"
            label="Palavra-passe"
            autoComplete="current-password"
          />

          <SubmitButton
            pendingText="A entrar…"
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
          >
            Entrar
          </SubmitButton>
        </form>

        <p className="mt-5 text-sm text-muted">
          <Link
            href="/recuperar-password"
            className="font-medium text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground"
          >
            Esqueceste-te da palavra-passe?
          </Link>
        </p>

        <p className="mt-2 text-sm text-muted">
          Ainda não tens conta?{' '}
          <Link
            href="/registo"
            className="font-medium text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
