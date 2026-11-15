import Link from '@/components/LinkRapido'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signup } from './actions'
import SubmitButton from '@/components/SubmitButton'
import PasswordInput from '@/components/PasswordInput'

export default async function RegistoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data.user) {
    redirect('/')
  }

  const { error, success } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border-subtle bg-surface p-8 shadow-card-hover">
        <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Criar conta
        </h1>
        <p className="mt-1 text-sm text-muted">
          Regista-te com o teu email e uma palavra-passe.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            {success}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4" action={signup}>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="nome"
              className="text-sm font-medium text-foreground/80"
            >
              Nome
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              autoComplete="name"
              className="rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand/60"
            />
          </div>

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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand/60"
            />
          </div>

          <PasswordInput
            id="password"
            name="password"
            label="Palavra-passe"
            autoComplete="new-password"
            minLength={6}
          />

          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmar palavra-passe"
            autoComplete="new-password"
            minLength={6}
          />

          <SubmitButton
            pendingText="A criar conta…"
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
          >
            Criar conta
          </SubmitButton>
        </form>

        <p className="mt-6 text-sm text-muted">
          Já tens conta?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground"
          >
            Iniciar sessão
          </Link>
        </p>
      </div>
    </div>
  )
}
