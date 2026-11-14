'use client'

import { useMemo, useRef, useState } from 'react'
import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

export type LinhaGrelha = {
  sub: string | null
  rotulo: string
  valores: number[]
  // Meses em que a célula junta mais de um lançamento, ou tem algum por
  // pagar — só para a dica ao passar o rato.
  varios: boolean[]
  porPagar: boolean[]
}
export type BlocoGrelha = { categoria: string; soLeitura: boolean; linhas: LinhaGrelha[] }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const chave = (categoria: string, sub: string | null, mes: number) => `${categoria}\u0000${sub ?? ''}\u0000${mes}`

function paraTexto(v: number): string {
  if (!v) return ''
  return v.toFixed(2).replace('.', ',')
}

// "1 234,56", "1.234,56" ou "1234.56" → 1234.56; vazio → 0; inválido → null.
function paraNumero(texto: string): number | null {
  const t = texto.replace(/[\s€]/g, '')
  if (t === '') return 0
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normal)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

const fmt = (v: number) =>
  v === 0
    ? '–'
    : `${v < 0 ? '−' : ''}${Math.abs(v)
        .toFixed(2)
        .replace('.', ',')
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`

// Tabela do ano ao estilo Excel: blocos (categorias) e linhas
// (subcategorias) à esquerda, meses em cima, um valor por célula. As
// alterações ficam marcadas e só são gravadas com "Guardar alterações".
export default function GrelhaAnual({
  blocos,
  ano,
  estudioId,
  mesAtual,
  voltar,
  action,
}: {
  blocos: BlocoGrelha[]
  ano: number
  estudioId: number
  // 0–11 quando o ano é o atual, -1 caso contrário (realça a coluna).
  mesAtual: number
  voltar: string
  action: (formData: FormData) => void
}) {
  const { marcarSujo, limparSujo } = useAvisoSairSemGuardar()
  const [editados, setEditados] = useState<Record<string, string>>({})
  const [esconderVazias, setEsconderVazias] = useState(false)
  const tabela = useRef<HTMLTableElement>(null)

  const original = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of blocos) for (const l of b.linhas) l.valores.forEach((v, i) => m.set(chave(b.categoria, l.sub, i), v))
    return m
  }, [blocos])

  const valorDe = (k: string) => {
    if (k in editados) return paraNumero(editados[k]) ?? original.get(k) ?? 0
    return original.get(k) ?? 0
  }

  const alteracoes = Object.entries(editados)
    .map(([k, texto]) => ({ k, valor: paraNumero(texto) }))
    .filter((a) => a.valor !== null && Math.abs(a.valor - (original.get(a.k) ?? 0)) > 0.004)
  const invalidas = Object.values(editados).some((t) => paraNumero(t) === null)

  function alterar(k: string, texto: string) {
    setEditados((e) => ({ ...e, [k]: texto }))
    marcarSujo()
  }

  // Enter e setas ↑/↓ saltam de linha, como numa folha de cálculo.
  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const mes = e.currentTarget.dataset.mes
    const celulas = [...(tabela.current?.querySelectorAll<HTMLInputElement>(`input[data-mes="${mes}"]`) ?? [])]
    const i = celulas.indexOf(e.currentTarget)
    const alvo = celulas[i + (e.key === 'ArrowUp' ? -1 : 1)]
    alvo?.focus()
    alvo?.select()
  }

  const totaisMes = Array.from({ length: 12 }, (_, i) =>
    blocos.reduce((s, b) => s + b.linhas.reduce((t, l) => t + valorDe(chave(b.categoria, l.sub, i)), 0), 0)
  )
  const celCls = 'border-b border-border-subtle/60 px-1 py-0.5 text-right'
  const colMes = (i: number) => (i === mesAtual ? 'bg-brand/[.07]' : '')

  return (
    <form
      action={action}
      onSubmit={limparSujo}
      className="mt-4"
      // Enter numa célula muda de linha — nunca submete a tabela a meio.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault()
      }}
    >
      <input type="hidden" name="ano" value={ano} />
      <input type="hidden" name="estudio_id" value={estudioId} />
      <input type="hidden" name="voltar" value={voltar} />
      <input
        type="hidden"
        name="alteracoes"
        value={JSON.stringify(
          alteracoes.map((a) => {
            const [categoria, sub, mes] = a.k.split('\u0000')
            return { categoria, subcategoria: sub || null, mes: Number(mes) + 1, valor: a.valor }
          })
        )}
      />

      <div className="sticky top-[60px] z-20 flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface/95 px-4 py-2 backdrop-blur">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={esconderVazias} onChange={(e) => setEsconderVazias(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
          Esconder linhas sem valores
        </label>
        <span className="ml-auto text-xs text-muted">
          {invalidas ? (
            <span className="font-semibold text-red-300">Há valores que não são números.</span>
          ) : alteracoes.length ? (
            <span className="font-semibold text-amber-300">
              {alteracoes.length} célula{alteracoes.length === 1 ? '' : 's'} por guardar
            </span>
          ) : (
            'Escreve o valor na célula do mês · Enter ou ↓ passa à linha de baixo'
          )}
        </span>
        <SubmitButton
          pendingText="A guardar…"
          disabled={alteracoes.length === 0 || invalidas}
          className="rounded-full bg-brand px-5 py-1.5 text-xs font-bold text-black hover:bg-brand-strong"
        >
          Guardar alterações
        </SubmitButton>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table ref={tabela} className="w-full min-w-[1180px] border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="text-muted">
              <th className="sticky left-0 z-10 min-w-56 border-b border-border-subtle bg-surface px-3 py-2 text-left font-semibold uppercase tracking-wider">
                {ano}
              </th>
              {MESES.map((m, i) => (
                <th key={m} className={`border-b border-border-subtle px-1 py-2 text-right font-semibold uppercase tracking-wider ${colMes(i)}`}>
                  {m}
                </th>
              ))}
              <th className="border-b border-l border-border-subtle px-2 py-2 text-right font-semibold uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {blocos.map((b) => {
              const totalBloco = Array.from({ length: 12 }, (_, i) => b.linhas.reduce((s, l) => s + valorDe(chave(b.categoria, l.sub, i)), 0))
              const linhas = b.linhas.filter(
                (l) => !esconderVazias || l.valores.some((v) => v !== 0) || MESES.some((_, i) => chave(b.categoria, l.sub, i) in editados)
              )
              if (esconderVazias && linhas.length === 0) return null
              return (
                <FragmentoBloco key={b.categoria}>
                  <tr className="bg-brand/[.10] font-bold text-foreground">
                    <td className="sticky left-0 z-10 border-b border-border-subtle bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] px-3 py-1.5 text-left">
                      {b.categoria}
                    </td>
                    {totalBloco.map((v, i) => (
                      <td key={i} className={`border-b border-border-subtle px-2 py-1.5 text-right font-mono ${colMes(i)}`}>
                        {fmt(v)}
                      </td>
                    ))}
                    <td className="border-b border-l border-border-subtle px-2 py-1.5 text-right font-mono">{fmt(totalBloco.reduce((s, v) => s + v, 0))}</td>
                  </tr>
                  {linhas.map((l) => {
                    const total = MESES.reduce((s, _, i) => s + valorDe(chave(b.categoria, l.sub, i)), 0)
                    return (
                      <tr key={l.sub ?? ''} className="group hover:bg-foreground/[.03]">
                        <td className="sticky left-0 z-10 border-b border-border-subtle/60 bg-surface px-3 py-1 pl-6 text-left text-foreground group-hover:bg-[color-mix(in_srgb,var(--foreground)_3%,var(--surface))]">
                          {l.rotulo}
                        </td>
                        {MESES.map((_, i) => {
                          const k = chave(b.categoria, l.sub, i)
                          const editado = k in editados
                          const invalido = editado && paraNumero(editados[k]) === null
                          const mudou = editado && !invalido && Math.abs((paraNumero(editados[k]) ?? 0) - (original.get(k) ?? 0)) > 0.004
                          return (
                            <td key={i} className={`${celCls} ${colMes(i)}`}>
                              {b.soLeitura ? (
                                <span className="block px-1 py-1 font-mono text-muted">{fmt(l.valores[i])}</span>
                              ) : (
                                <input
                                  data-mes={i}
                                  inputMode="decimal"
                                  aria-label={`${l.rotulo}, ${MESES[i]}`}
                                  title={
                                    l.varios[i]
                                      ? 'Soma de vários lançamentos deste mês (ver em Despesas do mês)'
                                      : l.porPagar[i]
                                        ? 'Ainda por pagar'
                                        : undefined
                                  }
                                  value={editado ? editados[k] : paraTexto(l.valores[i])}
                                  onChange={(e) => alterar(k, e.target.value)}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onKeyDown={aoTeclar}
                                  // Em linha: o tema da Administração dá
                                  // cor própria aos campos e ganhava às
                                  // classes.
                                  style={
                                    invalido
                                      ? { borderColor: '#ef4444', background: 'rgba(239,68,68,.12)' }
                                      : mudou
                                        ? { borderColor: '#fbbf24', background: 'rgba(251,191,36,.16)' }
                                        : undefined
                                  }
                                  className={`w-full min-w-[68px] rounded border bg-transparent px-1 py-1 text-right font-mono outline-none focus:border-brand focus:bg-background ${
                                    invalido
                                      ? 'border-red-500 text-red-300'
                                      : mudou
                                        ? 'border-amber-400/70 bg-amber-400/10 text-foreground'
                                        : `border-transparent hover:border-border-subtle ${l.porPagar[i] ? 'text-amber-300' : 'text-foreground'}`
                                  }`}
                                />
                              )}
                            </td>
                          )
                        })}
                        <td className="border-b border-l border-border-subtle/60 px-2 py-1 text-right font-mono text-muted">{fmt(total)}</td>
                      </tr>
                    )
                  })}
                </FragmentoBloco>
              )
            })}
            <tr className="bg-brand/[.16] font-bold text-foreground">
              <td className="sticky left-0 z-10 bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface))] px-3 py-2 text-left uppercase tracking-wider">
                Total de gastos
              </td>
              {totaisMes.map((v, i) => (
                <td key={i} className="px-2 py-2 text-right font-mono">
                  {fmt(v)}
                </td>
              ))}
              <td className="border-l border-border-subtle px-2 py-2 text-right font-mono">{fmt(totaisMes.reduce((s, v) => s + v, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  )
}

function FragmentoBloco({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
