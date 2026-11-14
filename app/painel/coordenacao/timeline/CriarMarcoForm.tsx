'use client'

import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'
import type { TipoMarcoEmpresa, Estudio } from '@/lib/supabase/database.types'

const TIPOS_MARCO: TipoMarcoEmpresa[] = ['Campanha', 'Preço', 'Equipa', 'Meta', 'Outro']

export default function CriarMarcoForm({
  hoje,
  estudios,
  action,
}: {
  hoje: string
  estudios: Pick<Estudio, 'id' | 'nome'>[]
  action: (formData: FormData) => void
}) {
  const { marcarSujo } = useAvisoSairSemGuardar()

  return (
    <form
      action={action}
      onChange={marcarSujo}
      className="mt-2 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="titulo"
          required
          placeholder="ex.: Campanha Instagram outubro"
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          type="date"
          name="data"
          required
          defaultValue={hoje}
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <select
          name="tipo"
          defaultValue="Outro"
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        >
          {TIPOS_MARCO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          name="estudio_id"
          defaultValue=""
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="">Ambos os estúdios</option>
          {estudios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="descricao"
        rows={2}
        placeholder="Notas (opcional)"
        className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <SubmitButton
        pendingText="A guardar…"
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
      >
        Adicionar
      </SubmitButton>
    </form>
  )
}
