'use client'

import { useRouter } from 'next/navigation'

// Filtro de instrutor da Agenda num menu compacto (em vez de um botão por
// instrutor), para a barra de cima caber numa só linha.
export default function FiltroInstrutor({
  opcoes,
  valor,
}: {
  // Cada opção já traz o endereço para onde ir (mantém vista e semana).
  opcoes: { id: string; nome: string; href: string }[]
  valor: string
}) {
  const router = useRouter()
  const ativo = valor !== ''
  return (
    <label className="flex min-w-0 shrink-0 items-center text-xs text-muted max-sm:w-full max-sm:shrink">
      <select
        value={valor}
        aria-label="Filtrar por instrutor"
        onChange={(e) => {
          const o = opcoes.find((x) => x.id === e.target.value)
          if (o) router.push(o.href, { scroll: false })
        }}
        className={`rounded-full border py-1 pl-2.5 pr-7 text-xs font-medium outline-none max-sm:w-full max-sm:py-1.5 pointer-coarse:py-2 pointer-coarse:pl-3.5 pointer-coarse:text-base ${
          ativo ? 'border-brand bg-brand text-black' : 'border-border-subtle bg-surface text-foreground'
        }`}
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.id === '' ? 'Instrutor: todos' : o.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
