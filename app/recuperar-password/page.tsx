import Link from 'next/link'
import { requestPasswordReset } from './actions'
import SubmitButton from '@/components/SubmitButton'

export default async function RecuperarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RC Private Fitness Studio" className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-black dark:text-zinc-50">
          Recuperar palavra-passe
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Indica o teu email e enviamos um link para repor a palavra-passe.
        </p>

        {success && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {success}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4" action={requestPasswordReset}>
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

          <SubmitButton
            pendingText="A enviar…"
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
          >
            Enviar link
          </SubmitButton>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/login"
            className="font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
