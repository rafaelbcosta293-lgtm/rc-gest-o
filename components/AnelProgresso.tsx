import type { ReactNode } from 'react'

// Anel de progresso em SVG — puramente visual, sem estado, por isso pode
// ser usado diretamente a partir de um Server Component (não precisa de
// 'use client').
export default function AnelProgresso({
  percent,
  size = 56,
  strokeWidth = 5,
  color,
  trackColor = '#E5E7EB',
  children,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  color: string
  trackColor?: string
  children?: ReactNode
}) {
  const raio = (size - strokeWidth) / 2
  const perimetro = 2 * Math.PI * raio
  const preenchido = Math.min(100, Math.max(0, percent))
  const offset = perimetro * (1 - preenchido / 100)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={raio} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={raio}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={perimetro}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}
