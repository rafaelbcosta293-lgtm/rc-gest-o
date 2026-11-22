'use client'

import { useEffect } from 'react'

// Folha que sobe do fundo do ecrã (confirmações e pequenos formulários),
// em vez das janelas de aviso do browser.
export default function Folha({ titulo, aberta, aoFechar, children }: { titulo: string; aberta: boolean; aoFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', aoTeclar)
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = anterior
    }
  }, [aberta, aoFechar])

  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Fechar" onClick={aoFechar} className="absolute inset-0 animate-aparecer bg-black/45" />
      <div className="relative w-full max-w-lg animate-subir rounded-t-3xl bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200" aria-hidden />
        <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
