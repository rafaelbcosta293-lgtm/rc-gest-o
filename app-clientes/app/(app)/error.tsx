'use client'

import { WifiOff } from 'lucide-react'

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 pt-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-soft text-muted">
        <WifiOff className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight">Não foi possível carregar</h1>
      <p className="mt-1.5 text-[0.95rem] leading-snug text-muted">Verifique a ligação à internet e tente de novo.</p>
      <button type="button" onClick={reset} className="mt-6 h-12 rounded-xl bg-zinc-900 px-6 text-[0.95rem] font-semibold text-white active:bg-zinc-800">
        Tentar de novo
      </button>
    </div>
  )
}
