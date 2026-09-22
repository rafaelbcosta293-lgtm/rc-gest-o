import SubmitButton from '@/components/SubmitButton'

export default function PortaSenha({
  titulo,
  estudioSlug,
  destino,
  action,
  erro,
}: {
  titulo: string
  estudioSlug: string
  destino: string
  action: (formData: FormData) => void
  erro?: string
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-24 text-center">
      <span className="text-3xl">🔒</span>
      <h1 className="mt-3 text-lg font-semibold text-black dark:text-zinc-50">{titulo}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Esta área está protegida por password.
      </p>
      <form action={action} className="mt-6 flex w-full flex-col gap-3">
        <input type="hidden" name="estudio_slug" value={estudioSlug} />
        <input type="hidden" name="destino" value={destino} />
        <input
          type="password"
          name="senha"
          required
          autoFocus
          placeholder="Password"
          className="rounded-md border border-black/10 px-3 py-2 text-center text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
        />
        {erro && <p className="text-xs text-red-600">Password incorreta.</p>}
        <SubmitButton
          pendingText="A verificar…"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Entrar
        </SubmitButton>
      </form>
    </div>
  )
}
