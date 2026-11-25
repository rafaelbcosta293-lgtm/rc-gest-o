'use client'

import BarraEscolha from '@/components/BarraEscolha'

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
  return (
    <BarraEscolha
      rotulo="Filtrar por instrutor"
      valor={valor}
      realce={valor !== ''}
      className="max-sm:w-full max-sm:pl-2 max-sm:pr-5"
      opcoes={opcoes.map((o) => (o.id === '' ? { ...o, nome: 'Instrutor: todos' } : o))}
    />
  )
}
