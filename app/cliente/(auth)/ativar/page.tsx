import { createClient } from '@/lib/supabase/server'
import { ativarConta } from './actions'
import SubmitButton from '@/components/SubmitButton'
import PasswordInput from '@/components/PasswordInput'

export default async function AtivarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string; error?: string }>
}) {
  const { cliente_id: clienteId, error } = await searchParams

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const sessaoValida = Boolean(data.user) && Boolean(clienteId)

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RC Private Fitness Studio" className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-black dark:text-zinc-50">
          Ativar a tua conta
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Define a palavra-passe para entrares na app sempre que quiseres.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {sessaoValida ? (
          <form className="mt-6 flex flex-col gap-4" action={ativarConta}>
            <input type="hidden" name="cliente_id" value={clienteId} />
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
              pendingText="A ativar…"
              className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
            >
              Ativar e entrar
            </SubmitButton>
          </form>
        ) : (
          !error && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Este link de convite expirou ou já foi usado — pede à equipa do ginásio para te
              enviar um novo.
            </p>
          )
        )}
      </div>
    </div>
  )
}
