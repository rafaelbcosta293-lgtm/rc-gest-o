'use client'

import { useState } from 'react'
import { TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
import SubmitButton from '@/components/SubmitButton'
import ClienteCombobox from '@/components/ClienteCombobox'
import CamposSessaoExperimental, { type LeadOpcao } from '@/components/CamposSessaoExperimental'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'
import type { EscopoEditar } from '../actions'
import type { EventoAgenda, TipoEventoAgenda } from '@/lib/supabase/database.types'

const OPCOES_ESCOPO = [
  { valor: 'um', label: 'Só este' },
  { valor: 'seguintes', label: 'Este e seguintes' },
  { valor: 'serie', label: 'Toda a série' },
] as const

type EventoComCliente = EventoAgenda & { cliente: { id: string; nome: string; estudio_id: number } | null }

const inputCls =
  'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

export default function EditarEventoForm({
  slug,
  estudioId,
  evento,
  pts,
  clientes,
  outroEstudio,
  clientesOutroEstudio,
  leads,
  action,
}: {
  slug: string
  estudioId: number
  evento: EventoComCliente
  pts: { id: string; nome: string }[]
  clientes: { id: string; nome: string }[]
  outroEstudio: { id: number; nome: string } | null
  clientesOutroEstudio: { id: string; nome: string }[]
  leads: LeadOpcao[]
  action: (formData: FormData) => void
}) {
  const { marcarSujo } = useAvisoSairSemGuardar()
  const [tipo, setTipo] = useState<TipoEventoAgenda>(evento.tipo)
  // Já começa ligado se o cliente deste evento for mesmo do outro
  // estúdio (ver NovoEventoForm para a explicação completa da opção).
  const [clienteDeFora, setClienteDeFora] = useState(
    !!evento.cliente && evento.cliente.estudio_id !== estudioId
  )
  const experimental = tipo === 'Sessão experimental'
  const [escopo, setEscopo] = useState<EscopoEditar>('um')

  return (
    <form action={action} onChange={marcarSujo} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="id" value={evento.id} />

      <div>
        <label className="text-xs font-semibold text-muted">Tipo</label>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5 rounded-full bg-border-subtle p-1">
          {TIPOS_EVENTO_AGENDA.map((t) => (
            <label key={t} className="relative">
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-full px-1 py-1.5 text-center text-[10px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                {t}
              </span>
            </label>
          ))}
        </div>
      </div>

      {experimental ? (
        <CamposSessaoExperimental
          leads={leads}
          estudioSlug={slug}
          estudioId={estudioId}
          defaultNome={evento.titulo ?? ''}
          defaultTelefone={evento.telefone ?? ''}
          defaultLeadId={evento.lead_id ?? ''}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Cliente (opcional)</label>
            <ClienteCombobox
              clientes={clienteDeFora ? clientesOutroEstudio : clientes}
              defaultValue={evento.cliente}
              placeholder="— Reunião / outro (sem cliente) —"
            />
            {outroEstudio && (
              <label className="inline-flex w-fit items-center gap-1.5 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={clienteDeFora}
                  onChange={(e) => setClienteDeFora(e.target.checked)}
                  className="h-3 w-3"
                />
                Cliente de {outroEstudio.nome}
              </label>
            )}
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
      )}

      {experimental && (
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
      )}

      {!experimental && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Título (só se não houver cliente)</label>
          <input name="titulo" defaultValue={evento.titulo ?? ''} className={inputCls} />
        </div>
      )}

      {evento.serie_id && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-semibold text-muted">Ao guardar, aplicar a</legend>
          <div className="flex gap-1.5">
            {OPCOES_ESCOPO.map((o) => (
              <label
                key={o.valor}
                className="flex-1 cursor-pointer rounded-md border border-border-subtle px-3 py-2 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold"
              >
                <input
                  type="radio"
                  name="escopo"
                  value={o.valor}
                  checked={escopo === o.valor}
                  onChange={() => setEscopo(o.valor)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
          {escopo !== 'um' && (
            <p className="text-xs text-muted">
              A data de cada ocorrência mantém-se — só a hora, duração, instrutor, cliente, tipo e
              nota ficam iguais em todas.
            </p>
          )}
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Data</label>
          <input
            type="date"
            name="data"
            defaultValue={evento.data}
            required
            readOnly={escopo !== 'um'}
            title={escopo !== 'um' ? 'A data de cada ocorrência mantém-se — escolhe "Só este" para a mudar.' : undefined}
            className={`${inputCls} ${escopo !== 'um' ? 'opacity-50' : ''}`}
          />
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
