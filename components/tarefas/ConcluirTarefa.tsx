'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { mudarEstadoTarefa } from '@/app/painel/tarefasActions'

// O botão de concluir uma tarefa. Para concluir é obrigatório dizer quem
// a fez: ao clicar abre uma pequena lista com os nomes da equipa, e é
// tocar no nome que conclui. Numa conta pessoal a pessoa já é conhecida,
// por isso o clique conclui logo em nome dela. Numa tarefa já feita, o
// mesmo botão volta a abri-la.
export default function ConcluirTarefa({
  id,
  titulo,
  voltar,
  feita,
  pessoas,
  euId,
  variante = 'circulo',
}: {
  id: string
  titulo: string
  voltar: string
  feita: boolean
  pessoas: { id: string; nome: string }[]
  // A pessoa desta conta, quando a conta é pessoal.
  euId: string | null
  // "circulo": o círculo das listas; "mini": o do calendário; "botao":
  // um botão com texto (quadro).
  variante?: 'circulo' | 'mini' | 'botao'
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

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

  const direto = feita || !!euId
  const classeBotao =
    variante === 'botao'
      ? 'rounded-full border border-border-subtle px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-brand/[.08]'
      : variante === 'mini'
        ? 'flex h-4 w-4 items-center justify-center rounded-full border border-current text-transparent hover:text-current'
        : `flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
            feita ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border-strong text-transparent hover:border-emerald-600 hover:text-emerald-600'
          }`
  const conteudo =
    variante === 'botao' ? (
      feita ? (
        'Reabrir'
      ) : (
        <>
          <Check className="mr-1 inline h-3 w-3" strokeWidth={3} />
          Concluir
        </>
      )
    ) : (
      <Check className={variante === 'mini' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} strokeWidth={3} />
    )
  const rotulo = feita ? `Voltar a abrir: ${titulo}` : `Concluir: ${titulo}`

  return (
    <div ref={caixa} className="relative shrink-0">
      <form action={mudarEstadoTarefa}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="estado" value={feita ? 'por_fazer' : 'feito'} />
        <input type="hidden" name="voltar" value={voltar} />
        {!feita && euId && <input type="hidden" name="feita_por" value={euId} />}
        {direto ? (
          <button type="submit" title={feita ? 'Voltar a abrir' : 'Concluir'} aria-label={rotulo} className={classeBotao}>
            {conteudo}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              title="Concluir — indica quem fez"
              aria-label={rotulo}
              aria-haspopup="menu"
              aria-expanded={aberto}
              className={classeBotao}
            >
              {conteudo}
            </button>
            {aberto && (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-1.5 w-52 rounded-xl border border-border-subtle bg-surface p-1.5 text-left shadow-pop"
              >
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Quem fez?</p>
                {pessoas.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">Ainda não há pessoas na equipa.</p>}
                {pessoas.map((p) => (
                  <button
                    key={p.id}
                    type="submit"
                    name="feita_por"
                    value={p.id}
                    role="menuitem"
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-brand/[.12]"
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
