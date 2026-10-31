'use client'

import { TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
import SubmitButton from '@/components/SubmitButton'
import ClienteCombobox from '@/components/ClienteCombobox'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'
import type { EventoAgenda } from '@/lib/supabase/database.types'

type EventoComCliente = EventoAgenda & { cliente: { id: string; nome: string } | null }

const inputCls =
  'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

export default function EditarEventoForm({
  slug,
  evento,
  pts,
  clientes,
  action,
}: {
  slug: string
  evento: EventoComCliente
  pts: { id: string; nome: string }[]
  clientes: { id: string; nome: string }[]
  action: (formData: FormData) => void
}) {
  const { marcarSujo } = useAvisoSairSemGuardar()

  return (
    <form action={action} onChange={marcarSujo} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="id" value={evento.id} />

      <div>
        <label className="text-xs font-semibold text-muted">Tipo</label>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5 rounded-full bg-border-subtle p-1">
          {TIPOS_EVENTO_AGENDA.map((t) => (
            <label key={t} className="relative">
              <input
                type="radio"
                name="tipo"
                value={t}
                defaultChecked={t === evento.tipo}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-full px-1.5 py-1.5 text-center text-[11px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                {t}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Cliente (opcional)</label>
          <ClienteCombobox
            clientes={clientes}
            defaultValue={evento.cliente}
            placeholder="— Reunião / outro (sem cliente) —"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Instrutor (opcional)</label>
          <select name="pt_id" defaultValue={evento.pt_id ?? ''} className={inputCls}>
            <option value="">— Sem instrutor —</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted">Título (só se não houver cliente)</label>
        <input name="titulo" defaultValue={evento.titulo ?? ''} className={inputCls} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Data</label>
          <input type="date" name="data" defaultValue={evento.data} required className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Hora</label>
          <input
            type="time"
            name="hora_inicio"
            defaultValue={evento.hora_inicio.slice(0, 5)}
            required
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Duração (min)</label>
          <input
            type="number"
            name="duracao_min"
            min={5}
            max={240}
            step={1}
            list="duracoes-comuns"
            defaultValue={evento.duracao_min}
            required
            className={inputCls}
            title="Qualquer duração em minutos — as sugestões são só atalhos"
          />
          <datalist id="duracoes-comuns">
            {[30, 40, 45, 60, 90, 120].map((min) => (
              <option key={min} value={min} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted">Nota (opcional)</label>
        <textarea name="nota" rows={3} defaultValue={evento.nota ?? ''} className={inputCls} />
      </div>

      <SubmitButton
        pendingText="A guardar…"
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
      >
        Guardar alterações
      </SubmitButton>
    </form>
  )
}
