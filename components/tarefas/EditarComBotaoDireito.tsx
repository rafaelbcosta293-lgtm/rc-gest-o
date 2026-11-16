'use client'

import { useRouter } from 'next/navigation'

// Envolve uma tarefa (linha da lista, cartão do calendário…): clicar
// nela com o botão direito do rato — ou tocar e manter, no telemóvel —
// abre-a para editar.
export default function EditarComBotaoDireito({
  href,
  como: Elemento = 'li',
  className,
  title,
  children,
}: {
  href: string
  como?: 'li' | 'span' | 'div'
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <Elemento
      className={className}
      title={title}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        router.push(href)
      }}
    >
      {children}
    </Elemento>
  )
}
