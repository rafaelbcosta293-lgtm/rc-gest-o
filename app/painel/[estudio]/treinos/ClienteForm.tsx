import { ALERTAS } from '@/lib/data/constantes'
import type { Cliente, Perfil } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'
const labelCls = 'text-sm font-medium text-zinc-700 dark:text-zinc-300'

export default function ClienteForm({
  estudioSlug,
  estudioId,
  cliente,
  pts,
  action,
  error,
}: {
  estudioSlug: string
  estudioId: number
  cliente?: Cliente
  pts: Pick<Perfil, 'id' | 'nome'>[]
  action: (formData: FormData) => void
  error?: string
}) {
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="estudio_id" value={estudioId} />
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

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
          <input
            id="nome"
            name="nome"
            required
            defaultValue={cliente?.nome}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefone" className={labelCls}>
            Telefone
          </label>
          <input
            id="telefone"
            name="telefone"
            defaultValue={cliente?.telefone ?? ''}
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
            defaultValue={cliente?.email ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="objetivo" className={labelCls}>
            Objetivo
          </label>
          <input
            id="objetivo"
            name="objetivo"
            defaultValue={cliente?.objetivo ?? ''}
            placeholder="ex.: perda de massa gorda"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="frequencia_semanal" className={labelCls}>
            Treinos por semana
          </label>
          <select
            id="frequencia_semanal"
            name="frequencia_semanal"
            defaultValue={cliente?.frequencia_semanal ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}× por semana
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nascimento" className={labelCls}>
            Data de nascimento
          </label>
          <input
            id="nascimento"
            name="nascimento"
            type="date"
            defaultValue={cliente?.nascimento ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pt_principal_id" className={labelCls}>
            PT principal
          </label>
          <select
            id="pt_principal_id"
            name="pt_principal_id"
            defaultValue={cliente?.pt_principal_id ?? ''}
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
          <label htmlFor="alerta" className={labelCls}>
            Alerta ativo
          </label>
          <select
            id="alerta"
            name="alerta"
            defaultValue={cliente?.alerta ?? 'Nenhum'}
            className={inputCls}
          >
            {Object.keys(ALERTAS).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="alerta_detalhe" className={labelCls}>
            Detalhe do alerta
          </label>
          <input
            id="alerta_detalhe"
            name="alerta_detalhe"
            defaultValue={cliente?.alerta_detalhe ?? ''}
            placeholder="ex.: ombro direito — evitar press"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="evento" className={labelCls}>
            Prova / evento
          </label>
          <input
            id="evento"
            name="evento"
            defaultValue={cliente?.evento ?? ''}
            placeholder="ex.: Meia Maratona"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="evento_data" className={labelCls}>
            Data do evento
          </label>
          <input
            id="evento_data"
            name="evento_data"
            type="date"
            defaultValue={cliente?.evento_data ?? ''}
            className={inputCls}
          />
        </div>

        {cliente && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="estado" className={labelCls}>
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={cliente.estado}
              className={inputCls}
            >
              <option value="Ativo">Ativo</option>
              <option value="Suspenso">Suspenso</option>
              <option value="Ex-cliente">Ex-cliente</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notas" className={labelCls}>
          Notas gerais
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          defaultValue={cliente?.notas ?? ''}
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        className="mt-2 self-start rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        {cliente ? 'Guardar alterações' : 'Criar cliente'}
      </button>
    </form>
  )
}
