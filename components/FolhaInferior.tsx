'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Folha que sobe do fundo do ecrã — para menus e escolhas no telemóvel.
// Desenhada num portal para o body: as barras fixas usam desfoque
// (backdrop-filter), e um elemento "fixed" lá dentro ficava preso à barra
// em vez de ocupar o ecrã. `escuro` traz consigo o tema da Administração.
export default function FolhaInferior({
  aberta,
  aoFechar,
  titulo,
  escuro = false,
  children,
}: {
  aberta: boolean
  aoFechar: () => void
  titulo: string
  escuro?: boolean
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!aberta) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', tecla)
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = anterior
    }
  }, [aberta, aoFechar])

  // Só abre depois de um toque (no browser), por isso o body existe sempre.
  if (!aberta) return null
  return createPortal(
    <div className={`fixed inset-0 z-[60] flex items-end justify-center ${escuro ? 'dark' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Fechar" onClick={aoFechar} className="animate-aparecer absolute inset-0 bg-black/50" />
      <div className="animate-subir relative flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-border-subtle bg-surface text-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-mr-1.5 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-foreground/[.06] hover:text-foreground"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body
  )
}
