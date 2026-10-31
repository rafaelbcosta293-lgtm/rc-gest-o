'use client'

import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'
import { guardarTemplateLembrete } from './actions'

export default function TemplateForm({ valorInicial }: { valorInicial: string }) {
  const { marcarSujo } = useAvisoSairSemGuardar()

  return (
    <form action={guardarTemplateLembrete} onChange={marcarSujo} className="flex flex-col gap-2">
      <textarea
        name="valor"
        defaultValue={valorInicial}
        rows={4}
        className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <SubmitButton
        pendingText="…"
        className="self-start rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong"
      >
        Guardar modelo
      </SubmitButton>
    </form>
  )
}
