'use client'

import { useState } from 'react'
import SubmitButton from './SubmitButton'

// Âmbito ao apagar um evento de uma série repetida — ver EscopoApagar
// em app/painel/[estudio]/agenda/actions.ts (tipo igual, só não é
// importado diretamente para não puxar "use server" para este
// componente cliente).
const OPCOES = [
  { valor: 'um', label: 'Só este evento', aviso: 'Apagar só este evento? Não é possível desfazer.' },
  {
    valor: 'seguintes',
    label: 'Este e os seguintes',
    aviso: 'Apagar este evento e todos os seguintes desta série? Não é possível desfazer.',
  },
  {
    valor: 'anteriores',
    label: 'Este e os anteriores',
    aviso: 'Apagar este evento e todos os anteriores desta série? Não é possível desfazer.',
  },
  {
    valor: 'serie',
    label: 'Toda a série (passados e futuros)',
    aviso: 'Apagar TODOS os eventos desta série, passados e futuros? Não é possível desfazer.',
  },
] as const

export default function ApagarEventoComEscopo({
  action,
  campos,
  className,
}: {
  action: (formData: FormData) => void
  campos: Record<string, string>
  className: string
}) {
  const [aberto, setAberto] = useState(false)

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={className}>
        Apagar
      </button>
    )
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const escopo = new FormData(e.currentTarget).get('escopo') as string
        const aviso = OPCOES.find((o) => o.valor === escopo)?.aviso ?? OPCOES[0].aviso
        if (!window.confirm(aviso)) e.preventDefault()
      }}
      className="flex flex-1 flex-col gap-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
    >
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <p className="text-sm font-bold text-red-700 dark:text-red-300">
        Apagar evento — esta é uma série repetida
      </p>
      <fieldset className="flex flex-col gap-1.5">
        {OPCOES.map((o, i) => (
          <label
            key={o.valor}
            className="cursor-pointer rounded-md border border-border-subtle px-3 py-2 text-sm has-checked:border-red-400 has-checked:bg-red-100 has-checked:font-semibold dark:has-checked:bg-red-900/40"
          >
            <input type="radio" name="escopo" value={o.valor} defaultChecked={i === 0} required className="sr-only" />
            {o.label}
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-2">
        <SubmitButton
          pendingText="A apagar…"
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          Confirmar
        </SubmitButton>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold hover:bg-foreground/[.06]"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
