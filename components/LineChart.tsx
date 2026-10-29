// Gráfico de linhas multi-série, em SVG simples — mesma filosofia dos
// outros componentes de gráfico desta app (Sparkline, BarMeter): sem
// biblioteca de gráficos, renderizável no servidor.
export type SerieLinha = {
  nome: string
  cor: string
  valores: number[]
}

export default function LineChart({
  series,
  rotulosEixoX,
  altura = 160,
}: {
  series: SerieLinha[]
  rotulosEixoX: string[]
  altura?: number
}) {
  const n = rotulosEixoX.length
  const largura = Math.max(240, n * 36)
  const maximo = Math.max(1, ...series.flatMap((s) => s.valores))
  const padding = 8
  const x = (i: number) => padding + (i / Math.max(1, n - 1)) * (largura - padding * 2)
  const y = (v: number) => altura - padding - (v / maximo) * (altura - padding * 2)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura}`} width={largura} height={altura} className="block">
        {series.map((s) => (
          <polyline
            key={s.nome}
            points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={s.cor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) =>
          s.valores.map((v, i) => (
            <circle key={`${s.nome}-${i}`} cx={x(i)} cy={y(v)} r={2.5} fill={s.cor} />
          ))
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {series.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>
    </div>
  )
}
