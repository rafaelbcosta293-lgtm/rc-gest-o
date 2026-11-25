'use client'

import { useRouter } from 'next/navigation'

// Uma escolha em menu dentro da barra de ferramentas (instrutor, ordem,
// filtro…): ocupa pouco e mostra sempre o que está escolhido. Cada opção
// já traz o endereço para onde ir. Fica em destaque quando a escolha
// não é a habitual (está a filtrar ou a esconder alguma coisa).
export default function BarraEscolha({
  opcoes,
  valor,
  rotulo,
  realce = false,
  className = '',
}: {
  opcoes: { id: string; nome: string; href: string }[]
  valor: string
  // O que o menu escolhe, para leitores de ecrã ("Filtrar por instrutor").
  rotulo: string
  realce?: boolean
  className?: string
}) {
  const router = useRouter()
  return (
    <select
      value={valor}
      aria-label={rotulo}
      onChange={(e) => {
        const o = opcoes.find((x) => x.id === e.target.value)
        if (o) router.push(o.href, { scroll: false })
      }}
      className={`barra-campo max-w-full pr-7 font-medium ${realce ? 'realce' : ''} ${className}`}
    >
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nome}
        </option>
      ))}
    </select>
  )
}
