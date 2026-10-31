'use client'

import { useState } from 'react'
import { MESES } from '@/lib/data/presencas'

type Serie = { nome: string; cor: string; pontos: number[] }

// "formatar" não pode ser uma função recebida como prop — um Componente
// de Servidor não pode passar uma função a um Componente Cliente (só
// dados simples atravessam essa fronteira; foi exatamente este tipo de
// erro, com um ícone em vez de um formatador, que já tinha causado uma
// quebra em produção nesta sessão). Por isso recebe só "unidade" (um
// valor simples) e resolve o formatador aqui dentro.
const FORMATADORES = {
  numero: (v: number) => `${Math.round(v)}`,
  euro: (v: number) => `€${Math.round(v).toLocaleString('pt-PT')}`,
} as const

// Gráfico de evolução mensal — uma linha por estúdio, com legenda (que
// mostra a média pedida pelo dono), rótulo no fim de cada linha e um
// "crosshair" com tooltip ao passar o rato. Construído em SVG puro,
// sem biblioteca de gráficos (os dados são só 2 séries × poucos meses,
// não vale a pena o peso extra), seguindo as regras do design de dados
// desta app: traços finos (2px), pontas arredondadas, grelha discreta,
// rótulos de texto nunca na cor da série (a cor fica só no traço/ponto).
export default function GraficoEvolucao({
  meses,
  series,
  unidade,
}: {
  meses: number[]
  series: Serie[]
  unidade: keyof typeof FORMATADORES
}) {
  const formatar = FORMATADORES[unidade]
  const [hoverIndice, setHoverIndice] = useState<number | null>(null)

  const largura = 640
  const altura = 220
  const margem = { topo: 16, baixo: 28, esquerda: 8, direita: 54 }
  const areaL = largura - margem.esquerda - margem.direita
  const areaAltura = altura - margem.topo - margem.baixo

  const todosValores = series.flatMap((s) => s.pontos)
  const maximo = Math.max(1, ...todosValores)
  // Teto "redondo" acima do máximo (ex.: 83 → 100, 410 → 500) — para a
  // grelha mostrar números fáceis de ler, não o valor exato esticado.
  const ordem = Math.pow(10, Math.floor(Math.log10(maximo)))
  const teto = Math.ceil((maximo * 1.15) / ordem) * ordem

  const x = (i: number) => margem.esquerda + (areaL * i) / Math.max(1, meses.length - 1)
  const y = (v: number) => margem.topo + areaAltura - (areaAltura * v) / teto

  const linhas = series.map((s) => s.pontos.map((v, i) => `${x(i)},${y(v)}`).join(' '))
  const gridlines = [0, 0.5, 1]

  function aoMoverRato(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const xRel = ((e.clientX - rect.left) / rect.width) * largura
    const passo = areaL / Math.max(1, meses.length - 1)
    const indice = Math.round((xRel - margem.esquerda) / passo)
    setHoverIndice(Math.max(0, Math.min(meses.length - 1, indice)))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {series.map((s) => {
          const media = s.pontos.reduce((a, b) => a + b, 0) / Math.max(1, s.pontos.length)
          return (
            <div key={s.nome} className="flex items-center gap-1.5 text-xs">
              <span className="h-[2px] w-4 rounded-full" style={{ background: s.cor }} aria-hidden />
              <span className="font-semibold text-foreground">{s.nome}</span>
              <span className="text-muted">média {formatar(media)}</span>
            </div>
          )
        })}
      </div>

      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="w-full touch-none select-none"
        onMouseMove={aoMoverRato}
        onMouseLeave={() => setHoverIndice(null)}
        role="img"
        aria-label="Gráfico de evolução mensal"
      >
        {gridlines.map((f) => (
          <g key={f}>
            <line
              x1={margem.esquerda}
              x2={largura - margem.direita}
              y1={margem.topo + areaAltura * (1 - f)}
              y2={margem.topo + areaAltura * (1 - f)}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
            <text
              x={largura - margem.direita + 8}
              y={margem.topo + areaAltura * (1 - f)}
              dy="0.32em"
              className="fill-muted"
              fontSize={10}
            >
              {formatar(teto * f)}
            </text>
          </g>
        ))}

        {meses.map((mes, i) => (
          <text
            key={mes}
            x={x(i)}
            y={altura - 8}
            textAnchor="middle"
            className="fill-muted"
            fontSize={10}
          >
            {MESES[mes - 1].slice(0, 3)}
          </text>
        ))}

        {hoverIndice !== null && (
          <line
            x1={x(hoverIndice)}
            x2={x(hoverIndice)}
            y1={margem.topo}
            y2={margem.topo + areaAltura}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
        )}

        {series.map((s, si) => (
          <g key={s.nome}>
            <polyline
              points={linhas[si]}
              fill="none"
              stroke={s.cor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {hoverIndice !== null && (
              <circle cx={x(hoverIndice)} cy={y(s.pontos[hoverIndice])} r={4} fill={s.cor} stroke="var(--surface)" strokeWidth={2} />
            )}
            {/* Ponta final sempre visível, com o valor ao lado — a única
                etiqueta direta do gráfico (mais que isso vira ruído). */}
            <circle
              cx={x(meses.length - 1)}
              cy={y(s.pontos[s.pontos.length - 1])}
              r={4}
              fill={s.cor}
              stroke="var(--surface)"
              strokeWidth={2}
            />
            <text
              x={x(meses.length - 1) + 8}
              y={y(s.pontos[s.pontos.length - 1])}
              dy="0.32em"
              className="fill-foreground font-mono font-semibold"
              fontSize={11}
            >
              {formatar(s.pontos[s.pontos.length - 1])}
            </text>
          </g>
        ))}
      </svg>

      {hoverIndice !== null && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border-subtle bg-background/60 px-3 py-1.5 text-xs">
          <span className="font-semibold text-foreground">{MESES[meses[hoverIndice] - 1]}</span>
          {series.map((s) => (
            <span key={s.nome} className="flex items-center gap-1.5">
              <span className="h-[2px] w-3 rounded-full" style={{ background: s.cor }} aria-hidden />
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatar(s.pontos[hoverIndice])}
              </span>
              <span className="text-muted">{s.nome}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
