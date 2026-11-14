'use client'

import SubmitButton from '@/components/SubmitButton'

// O mesmo <form> tem dois botões (Guardar e Remover, via formAction) —
// só o de remover precisa de confirmação, por isso o onSubmit olha para
// qual dos dois foi mesmo clicado (submitter) antes de perguntar.
export default function ItemModeloForm({
  estudioSlug,
  item,
  atualizar,
  remover,
}: {
  estudioSlug: string
  item: { id: string; secao: string; item: string }
  atualizar: (formData: FormData) => void
  remover: (formData: FormData) => void
}) {
  return (
    <form
      action={atualizar}
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
        if (submitter?.dataset.remover !== undefined) {
          if (!window.confirm('Tens a certeza que queres remover este item da checklist?')) {
            e.preventDefault()
          }
        }
      }}
      className="flex flex-wrap items-center gap-1.5"
    >
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="id" value={item.id} />
      <input
        name="secao"
        defaultValue={item.secao}
        placeholder="Secção"
        className="w-28 rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-xs outline-none focus:border-brand"
      />
      <input
        name="item"
        defaultValue={item.item}
        className="min-w-[160px] flex-1 rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-xs outline-none focus:border-brand"
      />
      <SubmitButton pendingText="…" className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]">
        Guardar
      </SubmitButton>
      <SubmitButton
        formAction={remover}
        data-remover=""
        pendingText="…"
        aria-label="Remover item"
        className="text-lg text-zinc-400 hover:text-red-600"
      >
        ×
      </SubmitButton>
    </form>
  )
}
