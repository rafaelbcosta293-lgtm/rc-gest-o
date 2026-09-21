'use client'

import { useState } from 'react'

export default function CopiarTexto({ texto, className }: { texto: string; className?: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        } catch {
          // clipboard indisponível (ex.: sem HTTPS) — sem efeito visível
        }
      }}
      className={className}
    >
      {copiado ? 'Copiado ✓' : 'Copiar mensagem'}
    </button>
  )
}
