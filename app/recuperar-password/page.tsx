import Link from '@/components/LinkRapido'
import Image from 'next/image'
import { requestPasswordReset } from './actions'
import SubmitButton from '@/components/SubmitButton'

export default async function RecuperarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border-subtle bg-surface p-8 shadow-card-hover">
        <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Recuperar palavra-passe
        </h1>
        <p className="mt-1 text-sm text-muted">
          Indica o teu email e enviamos um link para repor a palavra-passe.
        </p>

        {success && (
          <p className="mt-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            {success}
          </p>
        )}

        <form className="mt-6 flex flex-col gap-4" action={requestPasswordReset}>
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

          <SubmitButton
            pendingText="A enviar…"
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
          >
            Enviar link
          </SubmitButton>
        </form>

        <p className="mt-6 text-sm text-muted">
          <Link
            href="/login"
            className="font-medium text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground"
          >
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
