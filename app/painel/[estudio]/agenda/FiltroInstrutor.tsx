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
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
      <span className="font-semibold">Instrutor:</span>
      <select
        value={valor}
        aria-label="Filtrar por instrutor"
        onChange={(e) => {
          const o = opcoes.find((x) => x.id === e.target.value)
          if (o) router.push(o.href, { scroll: false })
        }}
        className={`rounded-full border py-1 pl-2.5 pr-7 text-xs font-medium outline-none ${
          ativo ? 'border-brand bg-brand text-black' : 'border-border-subtle bg-surface text-foreground'
        }`}
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
