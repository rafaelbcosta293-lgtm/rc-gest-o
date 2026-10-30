import type { LucideIcon } from 'lucide-react'
import { Info } from 'lucide-react'
import Sparkline from './Sparkline'

type Tendencia = { valor: number; label?: string }

// Cartão de métrica ao estilo "painel técnico": número grande a mono
// (alinhamento tabular, não dança quando muda), badge de ícone, seta de
// tendência e um traço de histórico opcional — a unidade visual repetida
// nos dashboards (Administração, Coordenação, início do estúdio).
export default function StatCard({
  icone: Icone,
  cor = { bg: 'var(--accent-soft)', tx: 'var(--accent)' },
  label,
  valor,
  sufixo,
  tendencia,
  tendenciaInvertida = false,
  historico,
  aoVivo = false,
  formula,
}: {
  icone?: LucideIcon
  cor?: { bg: string; tx: string }
  label: string
  valor: string | number
  sufixo?: string
  tendencia?: Tendencia
  // Para métricas em que "descer" é bom (ex.: dias em atraso) — inverte
  // a cor da seta sem inverter o sinal mostrado.
  tendenciaInvertida?: boolean
  historico?: number[]
  aoVivo?: boolean
  // Fórmula exata do KPI (secção 7), para toda a gente ler o número da
  // mesma forma — title nativo, sem JS: funciona ao passar o rato e
  // também com toque longo na maioria dos browsers de tablet/telemóvel.
  formula?: string
}) {
  const subiu = tendencia ? tendencia.valor > 0 : null
  const corTendencia =
    subiu === null
      ? 'text-muted'
      : (subiu && !tendenciaInvertida) || (!subiu && tendenciaInvertida)
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icone && (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: cor.bg, color: cor.tx }}
            >
              <Icone className="h-4 w-4" strokeWidth={2.25} />
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {aoVivo && <span className="live-dot" aria-hidden />}
            {label}
            {formula && (
              <span title={formula} aria-label={`Fórmula: ${formula}`} tabIndex={0} className="cursor-help">
                <Info className="h-3 w-3" strokeWidth={2} />
              </span>
            )}
          </span>
        </div>
        {historico && historico.length > 1 && <Sparkline valores={historico} />}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-foreground">
          {valor}
        </span>
        {sufixo && <span className="text-sm font-medium text-muted">{sufixo}</span>}
      </div>

      {tendencia && (
        <p className={`mt-1.5 text-xs font-semibold ${corTendencia}`}>
          {subiu ? '▲' : '▼'} {Math.abs(tendencia.valor)}
          {tendencia.label ? ` ${tendencia.label}` : '%'}
        </p>
      )}
    </div>
  )
}
