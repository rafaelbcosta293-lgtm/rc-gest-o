'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Copia o resumo do mês (texto simples) para colar num email ao
// contabilista. Se o browser não deixar copiar sozinho, o texto fica
// selecionado na caixa por baixo, pronto para Ctrl+C.
export default function CopiarResumo({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<'parado' | 'copiado' | 'manual'>('parado')

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setEstado('copiado')
      setTimeout(() => setEstado('parado'), 2500)
    } catch {
      setEstado('manual')
      const caixa = document.getElementById('resumo-contabilista') as HTMLTextAreaElement | null
      caixa?.focus()
      caixa?.select()
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold text-black hover:bg-brand-strong"
      >
        {estado === 'copiado' ? <Check className="h-4 w-4" strokeWidth={3} /> : <Copy className="h-4 w-4" />}
        {estado === 'copiado' ? 'Copiado' : 'Copiar resumo para o contabilista'}
      </button>
      {estado === 'manual' && <p className="mt-2 text-xs text-amber-300">Não foi possível copiar sozinho — o texto está selecionado em baixo, usa Ctrl+C.</p>}
      <textarea
        id="resumo-contabilista"
        readOnly
        value={texto}
        rows={Math.min(18, texto.split('\n').length + 1)}
        className="mt-3 w-full rounded-lg px-3 py-2 font-mono text-xs leading-relaxed"
      />
    </div>
  )
}
