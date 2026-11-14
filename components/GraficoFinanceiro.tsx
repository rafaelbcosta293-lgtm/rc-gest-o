'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatarValor, type FormatoValor } from '@/lib/data/analiseFinanceira'

// Gráfico de barras + linhas num único eixo (sempre a mesma unidade),
// em SVG, com linha-guia e caixa de valores ao passar o rato/tocar.
// Barras agrupadas ou empilhadas; linhas podem ter falhas (null) e ser
// tracejadas (ex.: projeção). Mede a largura real do contentor para o
// texto nunca sair esticado.
export type SerieBarra = { nome: string; cor: string; valores: number[] }
export type SerieLinhaFin = { nome: string; cor: string; valores: (number | null)[]; tracejado?: boolean }

function passoBonito(bruto: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(bruto || 1)))
  const f = bruto / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp
}

export default function GraficoFinanceiro({
  rotulos,
  rotulosCurtos,
  barras = [],
  linhas = [],
  empilhar = false,
  formato = 'eur',
  altura = 260,
  mostrarTotal,
}: {
  rotulos: string[]
  rotulosCurtos?: string[]
  barras?: SerieBarra[]
  linhas?: SerieLinhaFin[]
  empilhar?: boolean
  formato?: FormatoValor
  altura?: number
  mostrarTotal?: boolean
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(800)
  const [ativo, setAtivo] = useState<number | null>(null)

  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.floor(e.contentRect.width))))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const n = rotulos.length
  const margem = { esq: 56, dir: 12, topo: 12, base: 26 }
  const w = largura - margem.esq - margem.dir
  const h = altura - margem.topo - margem.base
  const banda = n > 0 ? w / n : w

  const { minimo, maximo, ticks } = useMemo(() => {
    const valores: number[] = [0]
    if (empilhar) {
      for (let i = 0; i < n; i++) {
        let pos = 0
        let neg = 0
        for (const b of barras) {
          const v = b.valores[i] ?? 0
          if (v >= 0) pos += v
          else neg += v
        }
        valores.push(pos, neg)
      }
    } else {
      for (const b of barras) valores.push(...b.valores)
    }
    for (const l of linhas) for (const v of l.valores) if (v != null) valores.push(v)
    const lo = Math.min(...valores)
    const hi = Math.max(...valores, lo + 1)
    const passo = passoBonito((hi - lo) / 4)
    const minimo = Math.floor(lo / passo) * passo
    const maximo = Math.ceil(hi / passo) * passo
    const ticks: number[] = []
    for (let t = minimo; t <= maximo + passo / 2; t += passo) ticks.push(t)
    return { minimo, maximo, ticks }
  }, [barras, linhas, empilhar, n])

  const y = (v: number) => margem.topo + h - ((v - minimo) / (maximo - minimo || 1)) * h
  const xCentro = (i: number) => margem.esq + banda * i + banda / 2
  const y0 = y(0)

  const larguraBarraTotal = Math.min(48, banda * 0.72)
  const nGrupos = empilhar ? 1 : Math.max(1, barras.length)
  const larguraBarra = Math.max(1, (larguraBarraTotal - (nGrupos - 1) * 2) / nGrupos)
  const raio = Math.min(4, larguraBarra / 2)

  // Mostra só os rótulos do eixo X que cabem (≥ 52px entre eles).
  const saltoRotulo = Math.max(1, Math.ceil(52 / Math.max(1, banda)))
  const curtos = rotulosCurtos ?? rotulos

  function barraPath(x: number, topo: number, base: number, larg: number, arredondar: boolean) {
    const altoV = Math.abs(base - topo)
    if (altoV < 0.5) return ''
    const r = arredondar ? Math.min(raio, altoV) : 0
    const cima = topo < base // valor positivo: o arredondado fica em cima
    const yA = Math.min(topo, base)
    const yB = Math.max(topo, base)
    if (!r) return `M${x},${yA}h${larg}V${yB}h${-larg}Z`
    if (cima) {
      return `M${x},${yB}V${yA + r}q0,${-r} ${r},${-r}h${larg - 2 * r}q${r},0 ${r},${r}V${yB}Z`
    }
    return `M${x},${yA}h${larg}V${yB - r}q0,${r} ${-r},${r}h${-(larg - 2 * r)}q${-r},0 ${-r},${-r}Z`
  }

  const series = [...barras.map((b) => ({ nome: b.nome, cor: b.cor, tipo: 'barra' as const, tracejado: false })), ...linhas.map((l) => ({ nome: l.nome, cor: l.cor, tipo: 'linha' as const, tracejado: !!l.tracejado }))]

  const tooltipEsquerda = ativo !== null && xCentro(ativo) > largura * 0.6

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {series.map((s) => (
            <span key={s.nome} className="inline-flex items-center gap-1.5">
              {s.tipo === 'barra' ? (
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />
              ) : (
                <svg width="16" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="16" y2="3" stroke={s.cor} strokeWidth="2" strokeDasharray={s.tracejado ? '4 3' : undefined} />
                </svg>
              )}
              {s.nome}
            </span>
          ))}
        </div>
      )}
      <div ref={caixa} className="relative w-full select-none" onMouseLeave={() => setAtivo(null)}>
        <svg width={largura} height={altura} className="block" role="img" aria-label={series.map((s) => s.nome).join(', ')}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margem.esq} x2={largura - margem.dir} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border-subtle" strokeWidth={t === 0 ? 1 : 0.5} opacity={t === 0 ? 0.9 : 0.6} />
              <text x={margem.esq - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] text-[10px] tabular-nums">
                {formatarValor(t, formato, true)}
              </text>
            </g>
          ))}

          {ativo !== null && (
            <rect x={margem.esq + banda * ativo} y={margem.topo} width={banda} height={h} className="fill-[var(--foreground)]" opacity={0.05} />
          )}

          {barras.length > 0 &&
            rotulos.map((_, i) => {
              if (empilhar) {
                let pos = 0
                let neg = 0
                const segs = barras.map((b) => {
                  const v = b.valores[i] ?? 0
                  const base = v >= 0 ? pos : neg
                  if (v >= 0) pos += v
                  else neg += v
                  return { cor: b.cor, de: base, ate: base + v, v }
                })
                const ultimoPos = segs.map((s) => s.v > 0).lastIndexOf(true)
                const ultimoNeg = segs.map((s) => s.v < 0).lastIndexOf(true)
                const x = xCentro(i) - larguraBarraTotal / 2
                return (
                  <g key={i}>
                    {segs.map((s, k) => {
                      const topo = y(s.ate)
                      // 2px de intervalo entre segmentos empilhados
                      const base = k > 0 && s.de !== 0 ? y(s.de) + (s.v > 0 ? -1 : 1) : y(s.de)
                      const d = barraPath(x, topo, base, larguraBarraTotal, k === (s.v > 0 ? ultimoPos : ultimoNeg))
                      return d ? <path key={k} d={d} fill={s.cor} /> : null
                    })}
                  </g>
                )
              }
              return (
                <g key={i}>
                  {barras.map((b, k) => {
                    const v = b.valores[i] ?? 0
                    const x = xCentro(i) - larguraBarraTotal / 2 + k * (larguraBarra + 2)
                    const d = barraPath(x, y(v), y0, larguraBarra, true)
                    return d ? <path key={k} d={d} fill={b.cor} /> : null
                  })}
                </g>
              )
            })}

          {linhas.map((l) => {
            const segmentos: string[] = []
            let atual: string[] = []
            l.valores.forEach((v, i) => {
              if (v == null) {
                if (atual.length) segmentos.push(atual.join(' '))
                atual = []
              } else atual.push(`${xCentro(i)},${y(v)}`)
            })
            if (atual.length) segmentos.push(atual.join(' '))
            return (
              <g key={l.nome}>
                {segmentos.map((pts, k) =>
                  pts.includes(' ') ? (
                    <polyline key={k} points={pts} fill="none" stroke={l.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={l.tracejado ? '5 4' : undefined} />
                  ) : (
                    <circle key={k} cx={Number(pts.split(',')[0])} cy={Number(pts.split(',')[1])} r={3} fill={l.cor} />
                  )
                )}
                {ativo !== null && l.valores[ativo] != null && (
                  <circle cx={xCentro(ativo)} cy={y(l.valores[ativo]!)} r={4} fill={l.cor} stroke="var(--surface)" strokeWidth={2} />
                )}
              </g>
            )
          })}

          {rotulos.map((_, i) =>
            i % saltoRotulo === 0 ? (
              <text key={i} x={xCentro(i)} y={altura - 8} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
                {curtos[i]}
              </text>
            ) : null
          )}

          {rotulos.map((_, i) => (
            <rect
              key={`h${i}`}
              x={margem.esq + banda * i}
              y={0}
              width={banda}
              height={altura}
              fill="transparent"
              onMouseEnter={() => setAtivo(i)}
              onTouchStart={() => setAtivo(i)}
            />
          ))}
        </svg>

        {ativo !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-border-subtle bg-surface/95 px-3 py-2 text-xs shadow-card backdrop-blur"
            style={tooltipEsquerda ? { right: largura - xCentro(ativo) + 12 } : { left: xCentro(ativo) + 12 }}
          >
            <p className="mb-1 font-semibold text-foreground">{rotulos[ativo]}</p>
            {series.map((s, k) => {
              const v = k < barras.length ? barras[k].valores[ativo] : linhas[k - barras.length].valores[ativo]
              if (v == null) return null
              return (
                <p key={s.nome} className="flex items-center justify-between gap-4 text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.cor }} />
                    {s.nome}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">{formatarValor(v, formato)}</span>
                </p>
              )
            })}
            {mostrarTotal && barras.length > 1 && (
              <p className="mt-1 flex justify-between gap-4 border-t border-border-subtle pt-1 font-semibold text-foreground">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatarValor(barras.reduce((s, b) => s + (b.valores[ativo] ?? 0), 0), formato)}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
