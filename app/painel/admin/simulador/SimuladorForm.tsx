'use client'

import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { simular, type EntradasSimulador } from '@/lib/data/simulador'
import { guardarCenario, apagarCenario } from './actions'
import SubmitButton from '@/components/SubmitButton'

const ENTRADAS_OMISSAO: EntradasSimulador = {
  leadsPorMes: 100,
  taxaFecho: 0.1,
  churnMensal: 0.05,
  precoMedio: 50,
  margemBrutaPct: 0.7,
  nPts: 3,
  custoHoraPt: 8,
  horasPorPtPorMes: 100,
  custoMarketingMensal: 500,
  terceiroEstudio: false,
  custosFixosTerceiroEstudio: 1500,
}

const CAMPOS: {
  chave: keyof EntradasSimulador
  label: string
  min: number
  max: number
  step: number
  pct?: boolean
}[] = [
  { chave: 'leadsPorMes', label: 'Leads por mês', min: 0, max: 500, step: 5 },
  { chave: 'taxaFecho', label: 'Taxa de fecho', min: 0, max: 0.5, step: 0.01, pct: true },
  { chave: 'churnMensal', label: 'Churn mensal', min: 0, max: 0.3, step: 0.01, pct: true },
  { chave: 'precoMedio', label: 'Preço médio (€/mês)', min: 0, max: 300, step: 5 },
  { chave: 'margemBrutaPct', label: 'Margem bruta', min: 0, max: 1, step: 0.05, pct: true },
  { chave: 'nPts', label: 'Nº de PTs', min: 0, max: 20, step: 1 },
  { chave: 'custoHoraPt', label: 'Custo por hora de PT (€)', min: 0, max: 30, step: 0.5 },
  { chave: 'horasPorPtPorMes', label: 'Horas por PT/mês', min: 0, max: 200, step: 5 },
  { chave: 'custoMarketingMensal', label: 'Custo de marketing (€/mês)', min: 0, max: 5000, step: 50 },
  { chave: 'custosFixosTerceiroEstudio', label: 'Custos fixos do 3º estúdio (€/mês)', min: 0, max: 10000, step: 100 },
]

function fmtEuro(v: number | null) {
  return v == null ? '—' : `€${Math.round(v).toLocaleString('pt-PT')}`
}
function fmtPct(v: number | null) {
  return v == null ? '—' : `${Math.round(v * 100)}%`
}

export default function SimuladorForm({
  cenarios,
}: {
  cenarios: { id: string; nome: string; resultados: Record<string, unknown>; criado_em: string }[]
}) {
  const [entradas, setEntradas] = useState<EntradasSimulador>(ENTRADAS_OMISSAO)
  const [nomeCenario, setNomeCenario] = useState('')
  const resultado = useMemo(() => simular(entradas), [entradas])

  function atualizar<K extends keyof EntradasSimulador>(chave: K, valor: EntradasSimulador[K]) {
    setEntradas((atual) => ({ ...atual, [chave]: valor }))
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <div key={c.chave} className="flex flex-col gap-1.5">
            <label className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <span>{c.label}</span>
              <span className="font-mono tabular-nums text-muted">
                {c.pct ? fmtPct(entradas[c.chave] as number) : (entradas[c.chave] as number)}
              </span>
            </label>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={entradas[c.chave] as number}
              onChange={(e) => atualizar(c.chave, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={entradas.terceiroEstudio}
            onChange={(e) => atualizar('terceiroEstudio', e.target.checked)}
          />
          Abrir um 3º estúdio
        </label>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Resultado em tempo real</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="font-mono text-lg tabular-nums text-foreground">
              {resultado.clientesEstaveis != null ? Math.round(resultado.clientesEstaveis) : '∞'}
            </p>
            <p className="text-xs text-muted">clientes (estado estável)</p>
          </div>
          <div>
            <p className="font-mono text-lg tabular-nums text-foreground">{fmtEuro(resultado.mrr)}</p>
            <p className="text-xs text-muted">MRR</p>
          </div>
          <div>
            <p
              className={`font-mono text-lg tabular-nums ${
                resultado.margem != null && resultado.margem < 0 ? 'text-red-600' : 'text-foreground'
              }`}
            >
              {fmtEuro(resultado.margem)}
            </p>
            <p className="text-xs text-muted">Margem ({fmtPct(resultado.margemPct)})</p>
          </div>
          <div>
            <p className="font-mono text-lg tabular-nums text-foreground">
              {resultado.pontoDeEquilibrioClientes != null ? Math.ceil(resultado.pontoDeEquilibrioClientes) : '—'}
            </p>
            <p className="text-xs text-muted">Ponto de equilíbrio (clientes)</p>
          </div>
          <div>
            <p className="font-mono text-lg tabular-nums text-foreground">{fmtEuro(resultado.cac)}</p>
            <p className="text-xs text-muted">CAC</p>
          </div>
          <div>
            <p className="font-mono text-lg tabular-nums text-foreground">{fmtEuro(resultado.ltv)}</p>
            <p className="text-xs text-muted">LTV</p>
          </div>
          <div>
            <p className="font-mono text-lg tabular-nums text-foreground">
              {resultado.ratioLtvCac != null ? `${resultado.ratioLtvCac.toFixed(1)}×` : '—'}
            </p>
            <p className="text-xs text-muted">LTV / CAC</p>
          </div>
          <div>
            <p className="font-mono text-lg tabular-nums text-foreground">
              {resultado.mesesParaRecuperarCac != null ? `${resultado.mesesParaRecuperarCac.toFixed(1)} meses` : '—'}
            </p>
            <p className="text-xs text-muted">Para recuperar o CAC</p>
          </div>
        </div>
      </div>

      <form action={guardarCenario} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="entradas" value={JSON.stringify(entradas)} />
        <input type="hidden" name="resultados" value={JSON.stringify(resultado)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Nome do cenário</label>
          <input
            name="nome"
            required
            value={nomeCenario}
            onChange={(e) => setNomeCenario(e.target.value)}
            placeholder="ex.: Expansão 2027"
            className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
          />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong"
        >
          Guardar cenário
        </SubmitButton>
      </form>

      {cenarios.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Cenários guardados ({cenarios.length})
          </h2>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">MRR</th>
                  <th className="px-3 py-2">Margem</th>
                  <th className="px-3 py-2">LTV/CAC</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cenarios.map((c) => (
                  <tr key={c.id} className="border-t border-border-subtle">
                    <td className="px-3 py-2 font-medium text-foreground">{c.nome}</td>
                    <td className="px-3 py-2 text-muted">{fmtEuro(c.resultados.mrr as number | null)}</td>
                    <td className="px-3 py-2 text-muted">{fmtEuro(c.resultados.margem as number | null)}</td>
                    <td className="px-3 py-2 text-muted">
                      {c.resultados.ratioLtvCac != null ? `${(c.resultados.ratioLtvCac as number).toFixed(1)}×` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={apagarCenario}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          aria-label="Apagar cenário"
                          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
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
