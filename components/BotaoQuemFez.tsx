'use client'

import { useEffect, useRef, useState } from 'react'
import { comLembradoPrimeiro, lembrarQuemFez, useQuemLembrado } from './quemLembrado'

// Um botão de ação que pergunta primeiro "quem fez": ao clicar abre a
// lista da equipa (com o último nome usado neste aparelho em cima) e é
// tocar no nome que envia. Numa conta pessoal envia logo, em nome dela.
export default function BotaoQuemFez({
  action,
  ocultos,
  pessoas,
  euId,
  campo = 'quem_fez',
  pergunta = 'Quem fez?',
  className,
  title,
  alinhar = 'esquerda',
  children,
}: {
  action: (formData: FormData) => void
  // Os campos escondidos do formulário (id, estúdio…).
  ocultos: Record<string, string>
  pessoas: { id: string; nome: string }[]
  euId: string | null
  campo?: string
  pergunta?: string
  className?: string
  title?: string
  alinhar?: 'esquerda' | 'direita'
  children: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const lembrado = useQuemLembrado()

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  // Sem equipa carregada não se pergunta nada (o registo fica sem nome).
  const direto = !!euId || pessoas.length === 0

  return (
    <div ref={caixa} className="relative">
      <form action={action}>
        {Object.entries(ocultos).map(([nome, valor]) => (
          <input key={nome} type="hidden" name={nome} value={valor} />
        ))}
        {euId && <input type="hidden" name={campo} value={euId} />}
        {direto ? (
          <button type="submit" title={title} className={className}>
            {children}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setAberto((v) => !v)} title={title} aria-haspopup="menu" aria-expanded={aberto} className={className}>
              {children}
            </button>
            {aberto && (
              <div
                role="menu"
                className={`absolute top-full z-30 mt-1.5 w-52 rounded-xl border border-border-subtle bg-surface p-1.5 text-left shadow-pop ${alinhar === 'direita' ? 'right-0' : 'left-0'}`}
              >
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{pergunta}</p>
                {comLembradoPrimeiro(pessoas, lembrado).map((p) => (
                  <button
                    key={p.id}
                    type="submit"
                    name={campo}
                    value={p.id}
                    role="menuitem"
                    onClick={() => lembrarQuemFez(p.id)}
                    className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-brand/[.12] ${p.id === lembrado ? 'bg-brand/[.10] font-bold' : 'font-medium'}`}
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </form>
    </div>
  )
}
