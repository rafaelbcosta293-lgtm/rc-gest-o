// Anel de progresso circular — para uma percentagem isolada (ex.: "% de
// clientes em dia"), onde um anel comunica melhor o "quão cheio" do que
// uma barra comprida.
export default function RadialProgress({
  valor,
  tamanho = 64,
  espessura = 6,
  cor = 'var(--accent)',
  sufixo = '%',
}: {
  valor: number
  tamanho?: number
  espessura?: number
  cor?: string
  sufixo?: string
}) {
  const raio = (tamanho - espessura) / 2
  const circunferencia = 2 * Math.PI * raio
  const preenchido = (Math.max(0, Math.min(100, valor)) / 100) * circunferencia

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: tamanho, height: tamanho }}
    >
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={espessura}
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth={espessura}
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia - preenchido}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <span className="absolute font-mono text-sm font-bold tabular-nums text-foreground">
        {Math.round(valor)}
        {sufixo}
      </span>
    </div>
  )
}
