'use client'

import { Trash2 } from 'lucide-react'
import SubmitButton from '@/components/SubmitButton'

export default function ApagarSessaoForm({
  action,
  sessaoId,
  estudioSlug,
  clienteId,
}: {
  action: (formData: FormData) => void
  sessaoId: string
  estudioSlug: string
  clienteId: string
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm('Eliminar este treino do histórico? Esta ação não pode ser desfeita.')
        ) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="id" value={sessaoId} />
      <SubmitButton
        pendingText=""
        aria-label="Eliminar treino"
        className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
      >
        <Trash2 className="h-4 w-4" />
      </SubmitButton>
    </form>
  )
}
