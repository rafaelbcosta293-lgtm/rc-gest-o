import type { Avaliacao, Perfil } from '@/lib/supabase/database.types'
import SubmitButton from '@/components/SubmitButton'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'
const labelCls = 'text-sm font-medium text-zinc-700 dark:text-zinc-300'

function Campo({
  id,
  label,
  defaultValue,
  step = 'any',
  placeholder,
}: {
  id: string
  label: string
  defaultValue?: number | null
  step?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        step={step}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  )
}

export default function AvaliacaoForm({
  estudioSlug,
  clienteId,
  pts,
  avaliacao,
  action,
  error,
}: {
  estudioSlug: string
  clienteId: string
  pts: Pick<Perfil, 'id' | 'nome'>[]
  avaliacao?: Avaliacao
  action: (formData: FormData) => void
  error?: string
}) {
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="cliente_id" value={clienteId} />
      {avaliacao && <input type="hidden" name="id" value={avaliacao.id} />}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="data" className={labelCls}>
            Data
          </label>
          <input
            id="data"
            name="data"
            type="date"
            required
            defaultValue={avaliacao?.data ?? new Date().toISOString().slice(0, 10)}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pt_id" className={labelCls}>
            PT
          </label>
          <select
            id="pt_id"
            name="pt_id"
            defaultValue={avaliacao?.pt_id ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Composição corporal
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Campo id="peso_kg" label="Peso (kg)" defaultValue={avaliacao?.peso_kg} />
        <Campo id="altura_cm" label="Altura (cm)" defaultValue={avaliacao?.altura_cm} />
        <Campo
          id="massa_gorda_pct"
          label="Massa gorda (%)"
          defaultValue={avaliacao?.massa_gorda_pct}
        />
        <Campo
          id="massa_muscular_kg"
          label="Massa muscular (kg)"
          defaultValue={avaliacao?.massa_muscular_kg}
        />
        <Campo
          id="gordura_visceral"
          label="Gordura visceral"
          defaultValue={avaliacao?.gordura_visceral}
        />
        <Campo id="hidratacao_pct" label="Hidratação (%)" defaultValue={avaliacao?.hidratacao_pct} />
        <Campo
          id="metabolismo_kcal"
          label="Metabolismo (kcal)"
          step="1"
          defaultValue={avaliacao?.metabolismo_kcal}
        />
      </div>
      <p className="text-xs text-zinc-500">
        O IMC e a massa gorda/magra em kg são calculados sozinhos a partir do
        peso, da altura e da massa gorda (%), quando preenchidos.
      </p>

      <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota" className={labelCls}>
          Notas
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={3}
          defaultValue={avaliacao?.nota ?? ''}
          placeholder="ex.: manteve o peso, subiu massa muscular"
          className={inputCls}
        />
      </div>

      <SubmitButton
        pendingText="A guardar…"
        className="mt-2 self-start rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        {avaliacao ? 'Guardar alterações' : 'Guardar avaliação'}
      </SubmitButton>
    </form>
  )
}
