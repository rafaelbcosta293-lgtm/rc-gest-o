import { ESTADOS_LEAD } from '@/lib/data/constantes'
import type { Lead, Perfil } from '@/lib/supabase/database.types'
import SubmitButton from '@/components/SubmitButton'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'
const labelCls = 'text-sm font-medium text-zinc-700 dark:text-zinc-300'

const ESTADOS_EDITAVEIS = Object.keys(ESTADOS_LEAD).filter((k) => k !== 'Convertido')

export default function LeadForm({
  estudioSlug,
  estudioId,
  pts,
  lead,
  action,
  error,
}: {
  estudioSlug: string
  estudioId: number
  pts: Pick<Perfil, 'id' | 'nome'>[]
  lead?: Lead
  action: (formData: FormData) => void
  error?: string
}) {
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="estudio_id" value={estudioId} />
      {lead && <input type="hidden" name="id" value={lead.id} />}
      {lead && (
        <input
          type="hidden"
          name="visita_marcada_em_atual"
          value={lead.visita_marcada_em ?? ''}
        />
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome" className={labelCls}>
            Nome
          </label>
          <input id="nome" name="nome" required defaultValue={lead?.nome} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefone" className={labelCls}>
            Telefone
          </label>
          <input
            id="telefone"
            name="telefone"
            defaultValue={lead?.telefone ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={lead?.email ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="origem" className={labelCls}>
            Origem
          </label>
          <input
            id="origem"
            name="origem"
            defaultValue={lead?.origem ?? ''}
            placeholder="ex.: Instagram, indicação"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col justify-end gap-1.5 pb-2.5">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" name="walk_in" defaultChecked={lead?.walk_in ?? false} />
            Walk-in (apareceu sem marcação)
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="objetivo" className={labelCls}>
            Objetivo
          </label>
          <input
            id="objetivo"
            name="objetivo"
            defaultValue={lead?.objetivo ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="interesse" className={labelCls}>
            Interesse
          </label>
          <input
            id="interesse"
            name="interesse"
            defaultValue={lead?.interesse ?? ''}
            placeholder="ex.: PT individual, aulas de grupo"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="disponibilidade" className={labelCls}>
            Disponibilidade
          </label>
          <input
            id="disponibilidade"
            name="disponibilidade"
            defaultValue={lead?.disponibilidade ?? ''}
            placeholder="ex.: fins de tarde"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="responsavel_id" className={labelCls}>
            Responsável
          </label>
          <select
            id="responsavel_id"
            name="responsavel_id"
            defaultValue={lead?.responsavel_id ?? ''}
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="proximo_contacto" className={labelCls}>
            Próximo contacto
          </label>
          <input
            id="proximo_contacto"
            name="proximo_contacto"
            type="date"
            defaultValue={lead?.proximo_contacto ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="valor_potencial" className={labelCls}>
            Valor potencial (€)
          </label>
          <input
            id="valor_potencial"
            name="valor_potencial"
            type="number"
            step="any"
            defaultValue={lead?.valor_potencial ?? ''}
            className={inputCls}
          />
        </div>

        {lead && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="estado" className={labelCls}>
                Estado
              </label>
              <select
                id="estado"
                name="estado"
                defaultValue={lead.estado}
                className={inputCls}
              >
                {ESTADOS_EDITAVEIS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
                {lead.estado === 'Convertido' && <option value="Convertido">Convertido</option>}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="visita_data" className={labelCls}>
                Data da visita
              </label>
              <input
                id="visita_data"
                name="visita_data"
                type="date"
                defaultValue={lead.visita_data ?? ''}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="visita_hora" className={labelCls}>
                Hora da visita
              </label>
              <input
                id="visita_hora"
                name="visita_hora"
                type="time"
                defaultValue={lead.visita_hora ?? ''}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="motivo_perda" className={labelCls}>
                Motivo da perda
              </label>
              <input
                id="motivo_perda"
                name="motivo_perda"
                defaultValue={lead.motivo_perda ?? ''}
                placeholder="só é guardado se o estado for &quot;Perdido&quot;"
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota" className={labelCls}>
          Notas
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={2}
          defaultValue={lead?.nota ?? ''}
          className={inputCls}
        />
      </div>

      <SubmitButton
        pendingText="A guardar…"
        className="mt-2 self-start rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        {lead ? 'Guardar alterações' : 'Criar lead'}
      </SubmitButton>
    </form>
  )
}
