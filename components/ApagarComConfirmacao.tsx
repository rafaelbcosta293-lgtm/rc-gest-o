'use client'

import SubmitButton from './SubmitButton'

// Form de apagar com confirmação — pede sempre antes, para um clique
// a mais não apagar nada sem querer. `action` é uma Server Action
// passada pela página (pode atravessar a fronteira servidor→cliente,
// ao contrário de uma função normal).
export default function ApagarComConfirmacao({
  action,
  confirmacao,
  campos,
  className,
  children,
}: {
  action: (formData: FormData) => void
  confirmacao: string
  campos: Record<string, string>
  className: string
  children: React.ReactNode
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmacao)) e.preventDefault()
      }}
    >
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <SubmitButton pendingText="A apagar…" className={className}>
        {children}
      </SubmitButton>
    </form>
  )
}
