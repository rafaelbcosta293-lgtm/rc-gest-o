'use client'

import { useMemo, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import {
  calcularCenario,
  leadsParaMeta,
  trajetoria,
  type Cenario,
  type Meta,
  type Racios,
} from '@/lib/data/simulador'
import { formatarValor, rotuloMes, somarMeses } from '@/lib/data/analiseFinanceira'
import GraficoFinanceiro from '@/components/GraficoFinanceiro'
import { guardarCenario, apagarCenario } from './actions'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'

export type BaseReal = {
  racios: Racios
  leadsMes: number
  clientesAtuais: number
  mrrAtual: number
  novosMes: number
  ptsAtuais: number | null
  semDados: Partial<Record<keyof Racios, boolean>>
  janela: string
}

const eur = (v: number | null) => (v == null ? '—' : formatarValor(v, 'eur'))
const num = (v: number | null, casas = 0) =>
  v == null ? '—' : v.toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`)

const CAMPOS_RACIOS: {
  chave: keyof Racios
  label: string
  ajuda: string
  min: number
  max: number
  step: number
  formato: 'pct' | 'eur' | 'num'
}[] = [
  { chave: 'taxaFecho', label: 'Taxa de fecho', ajuda: 'Novos clientes ÷ leads', min: 0, max: 0.8, step: 0.005, formato: 'pct' },
  { chave: 'churn', label: 'Churn mensal', ajuda: 'Clientes que saem por mês', min: 0, max: 0.3, step: 0.0025, formato: 'pct' },
  { chave: 'arpu', label: 'Receita por cliente (€/mês)', ajuda: 'Preço médio efetivo', min: 0, max: 400, step: 1, formato: 'eur' },
  { chave: 'horasPtPorCliente', label: 'Horas de PT por cliente/mês', ajuda: 'Carga de treino por cliente', min: 0, max: 20, step: 0.1, formato: 'num' },
  { chave: 'horasPorPt', label: 'Horas por PT/mês', ajuda: 'Capacidade de cada PT', min: 10, max: 220, step: 1, formato: 'num' },
  { chave: 'custoHoraPt', label: 'Custo por hora de PT (€)', ajuda: 'Config. em Serviços', min: 0, max: 40, step: 0.5, formato: 'eur' },
  { chave: 'custoPorLead', label: 'Custo por lead (€)', ajuda: 'Marketing ÷ leads', min: 0, max: 100, step: 0.5, formato: 'eur' },
  { chave: 'custosFixos', label: 'Custos fixos (€/mês)', ajuda: 'Despesas sem PTs nem marketing (+ 3º estúdio…)', min: 0, max: 30000, step: 100, formato: 'eur' },
]

const METAS: { meta: Meta; label: string; formato: 'eur' | 'num'; casas: number }[] = [
  { meta: 'leadsMes', label: 'Leads por mês', formato: 'num', casas: 0 },
  { meta: 'novosMes', label: 'Novos clientes por mês', formato: 'num', casas: 1 },
  { meta: 'clientes', label: 'Clientes ativos (estável)', formato: 'num', casas: 0 },
  { meta: 'mrr', label: 'Receita mensal (MRR)', formato: 'eur', casas: 0 },
  { meta: 'pts', label: 'PTs necessários', formato: 'num', casas: 1 },
  { meta: 'marketing', label: 'Investimento em marketing (€/mês)', formato: 'eur', casas: 0 },
]

function fmtRacio(v: number, formato: 'pct' | 'eur' | 'num') {
  if (formato === 'pct') return pct(v)
  if (formato === 'eur') return `€${v.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}`
  return v.toLocaleString('pt-PT', { maximumFractionDigits: 1 })
}

export default function SimuladorForm({
  base,
  cenarios,
}: {
  base: BaseReal
  cenarios: { id: string; nome: string; resultados: Record<string, unknown>; criado_em: string }[]
}) {
  const inicial: Cenario = useMemo(() => ({ ...base.racios, leadsMes: base.leadsMes }), [base])
  const [cenario, setCenario] = useState<Cenario>(inicial)
  const [editando, setEditando] = useState<{ meta: Meta; texto: string } | null>(null)
  const [nomeCenario, setNomeCenario] = useState('')

  const r = useMemo(() => calcularCenario(cenario), [cenario])
  const rBase = useMemo(() => calcularCenario(inicial), [inicial])

  const valorMeta = (meta: Meta): number | null => {
    switch (meta) {
      case 'leadsMes':
        return r.leadsMes
      case 'novosMes':
        return r.novosMes
      case 'clientes':
        return r.clientesEstaveis
      case 'mrr':
        return r.mrr
      case 'pts':
        return r.ptsNecessarios
      case 'marketing':
        return r.custoMarketing
    }
  }

  function mudarMeta(meta: Meta, texto: string) {
    setEditando({ meta, texto })
    const v = Number(texto.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(v)) return
    const leads = leadsParaMeta(meta, v, cenario)
    if (leads != null) setCenario((c) => ({ ...c, leadsMes: leads }))
  }

  function mudarRacio(chave: keyof Racios, v: number) {
    setCenario((c) => ({ ...c, [chave]: v }))
  }

  // Trajetória dos próximos 24 meses: com os rácios reais vs simulado.
  const meses = 24
  const proxMeses = Array.from({ length: meses }, (_, i) =>
    somarMeses(new Date().toISOString().slice(0, 7), i + 1)
  )
  const trajReal = trajetoria(base.clientesAtuais, inicial, meses)
  const trajSim = trajetoria(base.clientesAtuais, cenario, meses)

  // "Hoje": números reais; o resto calculado com a base atual de clientes.
  const horasHoje = base.clientesAtuais * base.racios.horasPtPorCliente
  const custoPtHoje = horasHoje * base.racios.custoHoraPt
  const mktHoje = base.leadsMes * base.racios.custoPorLead
  const resultadoHoje = base.mrrAtual - custoPtHoje - mktHoje - base.racios.custosFixos
  const linhas: { nome: string; hoje: string; sim: string; delta?: number | null; inverter?: boolean }[] = [
    { nome: 'Leads por mês', hoje: num(base.leadsMes), sim: num(r.leadsMes), delta: dif(r.leadsMes, base.leadsMes) },
    { nome: 'Novos clientes por mês', hoje: num(base.novosMes, 1), sim: num(r.novosMes, 1), delta: dif(r.novosMes, base.novosMes) },
    { nome: 'Clientes ativos', hoje: num(base.clientesAtuais), sim: num(r.clientesEstaveis), delta: dif(r.clientesEstaveis, base.clientesAtuais) },
    { nome: 'Receita mensal (MRR)', hoje: eur(base.mrrAtual), sim: eur(r.mrr), delta: dif(r.mrr, base.mrrAtual) },
    { nome: 'Receita anual (ARR)', hoje: eur(base.mrrAtual * 12), sim: eur(r.arr), delta: dif(r.arr, base.mrrAtual * 12) },
    { nome: 'Horas de PT por mês', hoje: num(horasHoje), sim: num(r.horasPtMes), delta: dif(r.horasPtMes, horasHoje) },
    {
      nome: 'PTs necessários',
      hoje: base.ptsAtuais != null ? `${num(horasHoje / Math.max(1, base.racios.horasPorPt), 1)} (${base.ptsAtuais} a registar horas)` : num(horasHoje / Math.max(1, base.racios.horasPorPt), 1),
      sim: num(r.ptsNecessarios, 1),
    },
    { nome: 'Custo de PT', hoje: eur(custoPtHoje), sim: eur(r.custoPt), delta: dif(r.custoPt, custoPtHoje), inverter: true },
    { nome: 'Marketing', hoje: eur(mktHoje), sim: eur(r.custoMarketing), delta: dif(r.custoMarketing, mktHoje), inverter: true },
    { nome: 'Custos fixos', hoje: eur(base.racios.custosFixos), sim: eur(cenario.custosFixos) },
    { nome: 'Resultado mensal', hoje: eur(resultadoHoje), sim: eur(r.margem), delta: dif(r.margem, resultadoHoje) },
    { nome: 'Margem', hoje: pct(base.mrrAtual ? resultadoHoje / base.mrrAtual : null), sim: pct(r.margemPct) },
    { nome: 'Margem de contribuição por cliente', hoje: eur(rBase.margemContribuicaoCliente), sim: eur(r.margemContribuicaoCliente) },
    { nome: 'Ponto de equilíbrio (clientes)', hoje: num(rBase.pontoEquilibrioClientes), sim: num(r.pontoEquilibrioClientes), inverter: true },
    { nome: 'Vida média do cliente (meses)', hoje: num(rBase.vidaMediaMeses, 1), sim: num(r.vidaMediaMeses, 1) },
    { nome: 'LTV (valor do cliente)', hoje: eur(rBase.ltv), sim: eur(r.ltv), delta: dif(r.ltv, rBase.ltv) },
    { nome: 'CAC (custo por cliente novo)', hoje: eur(rBase.cac), sim: eur(r.cac), delta: dif(r.cac, rBase.cac), inverter: true },
    { nome: 'LTV / CAC', hoje: rBase.ratioLtvCac != null ? `${num(rBase.ratioLtvCac, 1)}×` : '—', sim: r.ratioLtvCac != null ? `${num(r.ratioLtvCac, 1)}×` : '—' },
    { nome: 'Meses para recuperar o CAC', hoje: num(rBase.mesesRecuperarCac, 1), sim: num(r.mesesRecuperarCac, 1), inverter: true },
  ]

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Rácios calculados de {base.janela}. Valores a âmbar ainda não têm dados reais — são referências.</p>
        <button
          type="button"
          onClick={() => {
            setCenario(inicial)
            setEditando(null)
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Repor valores reais
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Rácios do negócio</h2>
          <div className="mt-3 flex flex-col gap-4">
            {CAMPOS_RACIOS.map((c) => {
              const v = cenario[c.chave]
              const real = base.racios[c.chave]
              const semDados = base.semDados[c.chave]
              return (
                <div key={c.chave}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {c.label} <span className="text-muted">· {c.ajuda}</span>
                    </span>
                    <span className="font-mono tabular-nums text-foreground">{fmtRacio(v, c.formato)}</span>
                  </div>
                  <input
                    type="range"
                    min={c.min}
                    max={Math.max(c.max, real * 2)}
                    step={c.step}
                    value={v}
                    onChange={(e) => mudarRacio(c.chave, Number(e.target.value))}
                    className="mt-1.5 w-full"
                    aria-label={c.label}
                  />
                  <p className={`mt-0.5 text-[11px] ${semDados ? 'text-amber-400' : 'text-muted'}`}>
                    {semDados ? 'Sem dados reais — valor de referência' : `Real: ${fmtRacio(real, c.formato)}`}
                    {v !== real && (
                      <button type="button" onClick={() => mudarRacio(c.chave, real)} className="ml-2 underline hover:text-foreground">
                        repor
                      </button>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Metas (ligadas entre si)</h2>
          <p className="mt-1 text-xs text-muted">
            Escreve uma meta — as outras ajustam-se com os rácios ao lado. Ex.: para 250 clientes, quantas leads, PTs e
            marketing são precisos.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {METAS.map((m) => {
              const v = valorMeta(m.meta)
              const aEditar = editando?.meta === m.meta
              return (
                <label key={m.meta} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{m.label}</span>
                  <span className="flex items-center gap-1">
                    {m.formato === 'eur' && <span className="text-muted">€</span>}
                    <input
                      inputMode="decimal"
                      value={aEditar ? editando!.texto : v == null ? '' : num(v, m.casas).replace(/\s/g, ' ')}
                      onChange={(e) => mudarMeta(m.meta, e.target.value)}
                      onFocus={() => setEditando({ meta: m.meta, texto: v == null ? '' : String(Math.round(v * 10 ** m.casas) / 10 ** m.casas) })}
                      onBlur={() => setEditando(null)}
                      className="w-32 rounded-lg border border-border-subtle bg-background px-2 py-1.5 text-right font-mono text-sm tabular-nums text-foreground"
                    />
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Hoje vs simulado (estado estável)</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 font-semibold">Indicador</th>
                <th className="py-2 text-right font-semibold">Hoje (real)</th>
                <th className="py-2 text-right font-semibold">Simulado</th>
                <th className="py-2 text-right font-semibold">Variação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome} className="border-t border-border-subtle">
                  <td className="py-1.5 text-foreground">{l.nome}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-muted">{l.hoje}</td>
                  <td className="py-1.5 text-right font-mono font-semibold tabular-nums text-foreground">{l.sim}</td>
                  <td
                    className={`py-1.5 text-right font-mono tabular-nums ${
                      l.delta == null || Math.abs(l.delta) < 0.0005
                        ? 'text-muted'
                        : (l.delta > 0) !== !!l.inverter
                          ? 'text-emerald-400'
                          : 'text-red-400'
                    }`}
                  >
                    {l.delta == null ? '' : `${l.delta > 0 ? '+' : ''}${(l.delta * 100).toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Clientes nos próximos 24 meses</h2>
          <div className="mt-2">
            <GraficoFinanceiro
              formato="num"
              altura={220}
              rotulos={proxMeses.map((m) => rotuloMes(m))}
              rotulosCurtos={proxMeses.map((m) => rotuloMes(m, true))}
              linhas={[
                { nome: 'Com os rácios atuais', cor: '#7c8594', valores: trajReal.map((p) => Math.round(p.clientes)), tracejado: true },
                { nome: 'Simulado', cor: '#3987e5', valores: trajSim.map((p) => Math.round(p.clientes)) },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Receita mensal nos próximos 24 meses</h2>
          <div className="mt-2">
            <GraficoFinanceiro
              altura={220}
              rotulos={proxMeses.map((m) => rotuloMes(m))}
              rotulosCurtos={proxMeses.map((m) => rotuloMes(m, true))}
              linhas={[
                { nome: 'Com os rácios atuais', cor: '#7c8594', valores: trajReal.map((p) => Math.round(p.receita)), tracejado: true },
                { nome: 'Simulado', cor: '#199e70', valores: trajSim.map((p) => Math.round(p.receita)) },
              ]}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Receita acumulada a 24 meses: {eur(trajSim.reduce((s, p) => s + p.receita, 0))} simulado vs{' '}
            {eur(trajReal.reduce((s, p) => s + p.receita, 0))} com os rácios atuais.
          </p>
        </div>
      </section>

      <form action={guardarCenario} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="entradas" value={JSON.stringify(cenario)} />
        <input
          type="hidden"
          name="resultados"
          value={JSON.stringify({ ...r, clientes: r.clientesEstaveis })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Nome do cenário</label>
          <input
            name="nome"
            required
            value={nomeCenario}
            onChange={(e) => setNomeCenario(e.target.value)}
            placeholder="ex.: Expansão 2027"
            className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
        >
          Guardar cenário
        </SubmitButton>
      </form>

      {cenarios.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Cenários guardados ({cenarios.length})</h2>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Clientes</th>
                  <th className="px-3 py-2">MRR</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">LTV/CAC</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cenarios.map((c) => (
                  <tr key={c.id} className="border-t border-border-subtle">
                    <td className="px-3 py-2 font-medium text-foreground">{c.nome}</td>
                    <td className="px-3 py-2 text-muted">
                      {num((c.resultados.clientes ?? c.resultados.clientesEstaveis) as number | null)}
                    </td>
                    <td className="px-3 py-2 text-muted">{eur(c.resultados.mrr as number | null)}</td>
                    <td className="px-3 py-2 text-muted">{eur(c.resultados.margem as number | null)}</td>
                    <td className="px-3 py-2 text-muted">
                      {c.resultados.ratioLtvCac != null ? `${(c.resultados.ratioLtvCac as number).toFixed(1)}×` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ConfirmarAcao action={apagarCenario} confirmacao={`Tens a certeza que queres apagar o cenário "${c.nome}"?`}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          aria-label="Apagar cenário"
                          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </ConfirmarAcao>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function dif(sim: number | null, hoje: number | null): number | null {
  if (sim == null || hoje == null || hoje === 0) return null
  return (sim - hoje) / Math.abs(hoje)
}
