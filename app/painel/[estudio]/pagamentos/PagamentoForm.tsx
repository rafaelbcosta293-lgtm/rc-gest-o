'use client'

import { useState } from 'react'
import SubmitButton from '@/components/SubmitButton'
import type { Plano } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'
const labelCls = 'text-sm font-medium text-zinc-700 dark:text-zinc-300'

const METODOS = ['Numerário', 'Multibanco', 'MB Way', 'Transferência', 'Cartão']

function somarDias(dataISO: string, dias: number) {
  const d = new Date(`${dataISO}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export default function PagamentoForm({
  estudioSlug,
  clienteId,
  planos,
  action,
  error,
}: {
  estudioSlug: string
  clienteId: string
  planos: Plano[]
  action: (formData: FormData) => void
  error?: string
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [planoId, setPlanoId] = useState('')
  const [valor, setValor] = useState('')
  const [dataPagamento, setDataPagamento] = useState(hoje)
  const [validoAte, setValidoAte] = useState(somarDias(hoje, 30))

  const escolherPlano = (id: string) => {
    setPlanoId(id)
    const plano = planos.find((p) => p.id === id)
    if (plano) setValor(String(plano.valor))
  }

  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="cliente_id" value={clienteId} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Plano</label>
          <select
            name="plano_id"
            value={planoId}
            onChange={(e) => escolherPlano(e.target.value)}
            className={inputCls}
          >
            <option value="">— sem plano —</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.valor}€
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Valor (€)</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Método</label>
          <select name="metodo" defaultValue="Numerário" className={inputCls}>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Data do pagamento</label>
          <input
            name="data_pagamento"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Válido até</label>
          <input
            name="valido_ate"
            type="date"
            required
            value={validoAte}
            onChange={(e) => setValidoAte(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-300">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="inclui_inscricao" /> Inclui inscrição
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="inclui_seguro" /> Inclui seguro
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="inclui_reativacao" /> Inclui reativação
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Nota</label>
        <textarea name="nota" rows={2} className={inputCls} />
      </div>

      <SubmitButton
        pendingText="A guardar…"
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
      >
        Registar pagamento
      </SubmitButton>
    </form>
  )
}
