'use client'

import type { Avaliacao, Perfil } from '@/lib/supabase/database.types'
import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { calcularDerivados } from '@/lib/data/avaliacoes'
import { useState } from 'react'

// Caixas brancas (também no modo escuro), compactas, para preencher
// depressa uma avaliação inteira sem andar a rolar.
const inputCls =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand focus:ring-1 focus:ring-brand/40'
const labelCls = 'text-xs font-medium text-foreground/80'
const calculadoCls =
  'w-full rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'

function Campo({
  id,
  label,
  defaultValue,
  step = 'any',
  placeholder,
  aoMudar,
}: {
  id: string
  label: string
  defaultValue?: number | null
  step?: string
  placeholder?: string
  aoMudar?: (valor: number | null) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        step={step}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        onInput={aoMudar ? (e) => aoMudar(numero(e.currentTarget.value)) : undefined}
        className={inputCls}
      />
    </div>
  )
}

// Valor só para ver — calculado a partir de outros campos (a base de
// dados volta a calculá-lo ao guardar; não se envia).
function Calculado({ label, valor, titulo }: { label: string; valor: string; titulo: string }) {
  return (
    <div className="flex flex-col gap-1" title={titulo}>
      <span className={labelCls}>{label}</span>
      <span className={calculadoCls}>{valor}</span>
    </div>
  )
}

function numero(texto: string): number | null {
  const n = Number(texto.replace(',', '.'))
  return texto.trim() === '' || !Number.isFinite(n) ? null : n
}

export default function AvaliacaoForm({
  estudioSlug,
  clienteId,
  pts,
  avaliacao,
  alturaSugerida,
  action,
  error,
}: {
  estudioSlug: string
  clienteId: string
  pts: Pick<Perfil, 'id' | 'nome'>[]
  avaliacao?: Avaliacao
  alturaSugerida?: number | null
  action: (formData: FormData) => void
  error?: string
}) {
  const { marcarSujo } = useAvisoSairSemGuardar()
  const [peso, setPeso] = useState<number | null>(avaliacao?.peso_kg ?? null)
  const [gorduraPct, setGorduraPct] = useState<number | null>(avaliacao?.massa_gorda_pct ?? null)
  const [altura, setAltura] = useState<number | null>(avaliacao?.altura_cm ?? alturaSugerida ?? null)
  const { massaGordaKg, imc } = calcularDerivados(peso, gorduraPct, altura)

  return (
    <form action={action} onChange={marcarSujo} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="cliente_id" value={clienteId} />
      {avaliacao && <input type="hidden" name="id" value={avaliacao.id} />}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="data" className={labelCls}>
            Data
          </label>
          <input id="data" name="data" type="date" required defaultValue={avaliacao?.data ?? hojeEmLisboa()} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pt_id" className={labelCls}>
            PT
          </label>
          <select id="pt_id" name="pt_id" defaultValue={avaliacao?.pt_id ?? ''} className={inputCls}>
            <option value="">—</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <Campo id="altura_cm" label="Altura (cm)" defaultValue={avaliacao?.altura_cm ?? alturaSugerida} aoMudar={setAltura} />
        <div className="flex flex-col gap-1">
          <label htmlFor="proxima_reavaliacao" className={labelCls}>
            Próxima reavaliação
          </label>
          <input
            id="proxima_reavaliacao"
            name="proxima_reavaliacao"
            type="date"
            defaultValue={avaliacao?.proxima_reavaliacao ?? ''}
            className={inputCls}
          />
        </div>
      </div>

      <h2 className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">Composição corporal</h2>
      {/* Pela ordem em que a balança/folha de avaliação os dá. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Campo id="peso_kg" label="Peso (kg)" defaultValue={avaliacao?.peso_kg} aoMudar={setPeso} />
        <Campo id="massa_gorda_pct" label="Massa gorda (%)" defaultValue={avaliacao?.massa_gorda_pct} aoMudar={setGorduraPct} />
        <Calculado
          label="Massa gorda (kg)"
          valor={massaGordaKg != null ? String(massaGordaKg) : '—'}
          titulo="Calculada sozinha: peso × massa gorda (%)"
        />
        <Campo id="massa_muscular_kg" label="Massa muscular (kg)" defaultValue={avaliacao?.massa_muscular_kg} />
        <Campo id="densidade_ossea" label="Densidade óssea (kg)" defaultValue={avaliacao?.densidade_ossea} />
        <Calculado label="IMC" valor={imc != null ? String(imc) : '—'} titulo="Calculado sozinho a partir do peso e da altura" />
        <Campo id="metabolismo_kcal" label="Metabolismo (kcal)" step="1" defaultValue={avaliacao?.metabolismo_kcal} />
        <Campo id="idade_metabolica" label="Idade metabólica" step="1" defaultValue={avaliacao?.idade_metabolica} />
        <Campo id="hidratacao_pct" label="Hidratação (%)" defaultValue={avaliacao?.hidratacao_pct} />
        <Campo id="gordura_visceral" label="Gordura visceral" defaultValue={avaliacao?.gordura_visceral} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="nota" className={labelCls}>
          Notas
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={2}
          defaultValue={avaliacao?.nota ?? ''}
          placeholder="ex.: manteve o peso, subiu massa muscular"
          className={inputCls}
        />
      </div>

      <SubmitButton
        pendingText="A guardar…"
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
      >
        {avaliacao ? 'Guardar alterações' : 'Guardar avaliação'}
      </SubmitButton>
    </form>
  )
}
