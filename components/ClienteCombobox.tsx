'use client'

import { useEffect, useRef, useState } from 'react'

export type ClienteOpcao = { id: string; nome: string }

// Campo de cliente com pesquisa por texto — em vez de abrir um <select>
// com todos os clientes, escreve-se o início do nome e a lista filtra-se
// em tempo real (tudo no browser, a lista de clientes já vem carregada
// da página, por isso não há pedidos extra ao servidor).
export default function ClienteCombobox({
  clientes,
  nome = 'cliente_id',
  defaultValue = null,
  placeholder = 'Escreve para pesquisar…',
  onSelecionar,
  excluirIds,
}: {
  clientes: ClienteOpcao[]
  nome?: string
  defaultValue?: ClienteOpcao | null
  placeholder?: string
  // Quando definido, o campo passa a "adicionar pessoa" (treinos em
  // simultâneo): em vez de guardar a escolha num input escondido, avisa
  // quem usa o componente e limpa-se logo a seguir, para se poder
  // escrever o próximo nome sem fechar nada.
  onSelecionar?: (cliente: ClienteOpcao) => void
  // Nomes já escolhidos noutro sítio (ex.: outras pessoas já
  // adicionadas ao mesmo treino) — não voltam a aparecer na lista.
  excluirIds?: string[]
}) {
  const [texto, setTexto] = useState(defaultValue?.nome ?? '')
  const [selecionado, setSelecionado] = useState<ClienteOpcao | null>(defaultValue ?? null)
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  const disponiveis = excluirIds ? clientes.filter((c) => !excluirIds.includes(c.id)) : clientes
  const termo = texto.trim().toLowerCase()
  const filtrados = termo
    ? disponiveis.filter((c) => c.nome.toLowerCase().startsWith(termo)).slice(0, 8)
    : disponiveis.slice(0, 8)

  return (
    <div ref={containerRef} className="relative">
      {!onSelecionar && <input type="hidden" name={nome} value={selecionado?.id ?? ''} />}
      <input
        type="text"
        value={texto}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setTexto(e.target.value)
          if (!onSelecionar) setSelecionado(null)
          setAberto(true)
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      {aberto && filtrados.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border-subtle bg-surface py-1 shadow-pop">
          {filtrados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (onSelecionar) {
                  onSelecionar(c)
                  setTexto('')
                } else {
                  setSelecionado(c)
                  setTexto(c.nome)
                }
                setAberto(false)
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-brand/[.06]"
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}
      {aberto && termo && filtrados.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs text-muted shadow-pop">
          Sem resultados — fica em branco para reunião/outro, sem cliente.
        </div>
      )}
    </div>
  )
}
