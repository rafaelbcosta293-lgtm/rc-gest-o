import SubmitButton from '@/components/SubmitButton'
import { enviarSmsTeste } from './actions'

export default function TesteSmsForm({ textoInicial }: { textoInicial: string }) {
  return (
    <form action={enviarSmsTeste} className="flex flex-col gap-2">
      <input
        name="telefone"
        required
        placeholder="Número de teste (ex: 912345678)"
        className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <textarea
        name="texto"
        defaultValue={textoInicial}
        rows={3}
        className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <SubmitButton
        pendingText="A enviar…"
        className="self-start rounded-full border border-border-strong px-4 py-1.5 text-xs font-bold hover:bg-brand/[.08]"
      >
        Enviar SMS de Teste
      </SubmitButton>
    </form>
  )
}
