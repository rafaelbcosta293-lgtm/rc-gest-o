'use client'

import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

export default function ConfigAniversarioForm({
  slug,
  chave,
  label,
  valorInicial,
  action,
}: {
  slug: string
  chave: string
  label: string
  valorInicial: string
  action: (formData: FormData) => void
}) {
  const { marcarSujo } = useAvisoSairSemGuardar()

  return (
    <form action={action} onChange={marcarSujo} className="flex flex-col gap-1.5">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="chave" value={chave} />
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      <textarea
        name="valor"
        defaultValue={valorInicial}
        rows={3}
        className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <SubmitButton
        pendingText="…"
        className="self-start rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
      >
        Guardar
      </SubmitButton>
    </form>
  )
}
