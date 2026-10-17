import type { ReactNode } from 'react'
import { PALETA } from '@/lib/data/constantes'

// Mesma paleta usada em alertas, estados e leads — para que uma secção
// "âmbar" aqui seja exatamente o mesmo âmbar de um alerta ou badge,
// não uma variante parecida escolhida à parte.
export const CORES_SECCAO = {
  teal: PALETA.teal.tx,
  roxo: PALETA.roxo.tx,
  azul: PALETA.azul.tx,
  ambar: PALETA.ambar.tx,
  verde: PALETA.verde.tx,
  vermelho: PALETA.vermelho.tx,
  neutro: PALETA.neutro.tx,
  laranja: PALETA.laranja.tx,
} as const

export default function TituloSeccao({
  cor,
  id,
  children,
}: {
  cor: keyof typeof CORES_SECCAO
  id?: string
  children: ReactNode
}) {
  return (
    <h2
      id={id}
      className="mt-8 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
      style={{ color: CORES_SECCAO[cor] }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CORES_SECCAO[cor] }} />
      {children}
    </h2>
  )
}
