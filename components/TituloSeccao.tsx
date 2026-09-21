import type { ReactNode } from 'react'

// Paleta só para identificar rapidamente de que assunto trata cada
// secção (sobretudo em Coordenação/Administração, que têm muitas
// seguidas) — reaproveita as mesmas cores já usadas noutros sítios da
// app (alertas, leads, etc.), para manter tudo coerente.
export const CORES_SECCAO = {
  teal: '#0E9594',
  roxo: '#5B3FA0',
  azul: '#1F6FB2',
  ambar: '#9C6B00',
  verde: '#1E7145',
  vermelho: '#B3261E',
  neutro: '#6B7688',
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
