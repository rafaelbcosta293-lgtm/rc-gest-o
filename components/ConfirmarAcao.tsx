'use client'

// Mesmo mecanismo do ApagarComConfirmacao (confirmar antes de um clique
// a mais apagar algo sem querer), mas sem forçar a forma de um
// SubmitButton com texto — para botões de ícone ou outro conteúdo já
// existente dentro do <form>. `action` é uma Server Action (pode
// atravessar a fronteira servidor→cliente, ao contrário de uma função
// normal).
export default function ConfirmarAcao({
  action,
  confirmacao,
  className,
  children,
}: {
  action: (formData: FormData) => void
  confirmacao: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(confirmacao)) e.preventDefault()
      }}
    >
      {children}
    </form>
  )
}
