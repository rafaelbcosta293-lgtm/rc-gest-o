import { Lock } from 'lucide-react'
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
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand-strong shadow-pop">
        <Lock className="h-6 w-6" strokeWidth={2.25} />
      </span>
      <h1 className="mt-5 text-xl font-bold tracking-tight text-foreground">{titulo}</h1>
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
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong"
        >
          Entrar
        </SubmitButton>
      </form>
    </div>
  )
}
