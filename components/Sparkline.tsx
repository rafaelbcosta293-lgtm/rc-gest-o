// Mini-gráfico de tendência, em SVG puro — sem biblioteca de gráficos,
// só para um traço discreto ao lado de um número (StatCard). Renderiza
// no servidor, não precisa de JS nenhum no browser.
export default function Sparkline({
  valores,
  cor = 'var(--accent-glow, var(--accent))',
  largura = 72,
  altura = 26,
}: {
  valores: number[]
  cor?: string
  largura?: number
  altura?: number
}) {
  if (valores.length < 2) return null

  const max = Math.max(...valores)
  const min = Math.min(...valores)
  const intervalo = max - min || 1
  const passo = largura / (valores.length - 1)
  const y = (v: number) => altura - ((v - min) / intervalo) * (altura - 4) - 2

  const pontos = valores.map((v, i) => `${i * passo},${y(v)}`).join(' ')
  const ultimoX = (valores.length - 1) * passo
  const ultimoY = y(valores[valores.length - 1])

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        points={pontos}
        fill="none"
        stroke={cor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={ultimoX} cy={ultimoY} r={2.25} fill={cor} />
    </svg>
  )
}
