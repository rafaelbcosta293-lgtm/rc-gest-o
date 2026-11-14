import Image from 'next/image'
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
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border-subtle bg-surface p-8 shadow-card-hover">
        <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Nova palavra-passe
        </h1>
        <p className="mt-1 text-sm text-muted">
          Escolhe uma nova palavra-passe para a tua conta.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
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
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
          >
            Guardar palavra-passe
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
