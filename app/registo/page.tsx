import Link from 'next/link'
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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RC Private Fitness Studio" className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-black dark:text-zinc-50">
          Criar conta
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Regista-te com o teu email e uma palavra-passe.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {success}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4" action={signup}>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="nome"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nome
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              autoComplete="name"
              className="rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
            />
          </div>

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
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
          >
            Criar conta
          </SubmitButton>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Já tens conta?{' '}
          <Link
            href="/login"
            className="font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Iniciar sessão
          </Link>
        </p>
      </div>
    </div>
  )
}
