'use client'

import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

export default function OcorrenciaForm({
  slug,
  registoId,
  valorInicial,
  action,
}: {
  slug: string
  registoId: string
  valorInicial: string
  action: (formData: FormData) => void
}) {
  const { marcarSujo } = useAvisoSairSemGuardar()

  return (
    <form action={action} onChange={marcarSujo} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="registo_id" value={registoId} />
      <textarea
        name="ocorrencia"
        rows={3}
        defaultValue={valorInicial}
        placeholder="ex.: torneira da casa de banho a pingar, avisar manutenção"
        className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
      />
      <SubmitButton
        pendingText="A guardar…"
        className="self-start rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]"
      >
        Guardar ocorrência
      </SubmitButton>
    </form>
  )
}
