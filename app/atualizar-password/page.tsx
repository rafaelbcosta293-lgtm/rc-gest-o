import { updatePassword } from './actions'
import SubmitButton from '@/components/SubmitButton'
import PasswordInput from '@/components/PasswordInput'

export default async function AtualizarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RC Private Fitness Studio" className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-black dark:text-zinc-50">
          Nova palavra-passe
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Escolhe uma nova palavra-passe para a tua conta.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4" action={updatePassword}>
          <PasswordInput
            id="password"
            name="password"
            label="Nova palavra-passe"
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
            pendingText="A guardar…"
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
          >
            Guardar palavra-passe
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
