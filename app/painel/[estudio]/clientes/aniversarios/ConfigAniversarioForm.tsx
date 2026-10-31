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
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <textarea
        name="valor"
        defaultValue={valorInicial}
        rows={3}
        className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900"
      />
      <SubmitButton
        pendingText="…"
        className="self-start rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium"
      >
        Guardar
      </SubmitButton>
    </form>
  )
}
