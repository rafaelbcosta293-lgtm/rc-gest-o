// Barra horizontal simples — comparar dois estúdios, ou mostrar "X de
// Y" (ex.: pagamentos em dia) de forma mais visual do que só o número.
export default function BarMeter({
  label,
  valor,
  total,
  cor = 'var(--accent)',
  mostrarPct = true,
}: {
  label: string
  valor: number
  total: number
  cor?: string
  mostrarPct?: boolean
}) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted">
          {valor}
          {mostrarPct && ` · ${pct}%`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: cor }}
        />
      </div>
    </div>
  )
}
