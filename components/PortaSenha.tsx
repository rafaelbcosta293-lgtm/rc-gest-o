import SubmitButton from '@/components/SubmitButton'

export default function PortaSenha({
  titulo,
  destino,
  action,
  erro,
}: {
  titulo: string
  destino: string
  action: (formData: FormData) => void
  erro?: string
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-2xl">
        🔒
      </span>
      <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{titulo}</h1>
      <p className="mt-1 text-sm text-muted">
        Esta área está protegida por password.
      </p>
      <form action={action} className="mt-6 flex w-full flex-col gap-3">
        <input type="hidden" name="destino" value={destino} />
        <input
          type="password"
          name="senha"
          required
          autoFocus
          placeholder="Password"
          className="rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-center text-sm outline-none transition-colors focus:border-brand/60"
        />
        {erro && <p className="text-xs text-red-600">Password incorreta.</p>}
        <SubmitButton
          pendingText="A verificar…"
          className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black hover:bg-brand-strong"
        >
          Entrar
        </SubmitButton>
      </form>
    </div>
  )
}
