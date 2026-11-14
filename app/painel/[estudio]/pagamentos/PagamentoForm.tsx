'use client'

import { useState } from 'react'
import SubmitButton from '@/components/SubmitButton'
import type { Plano } from '@/lib/supabase/database.types'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'
import { fimDoMes, validadeSugerida } from '@/lib/data/validadePagamento'

const inputCls =
  'rounded-md border border-black bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand/50 dark:border-white/30 dark:bg-zinc-900'
const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-zinc-500'

const METODOS = ['Numerário', 'Multibanco', 'MB Way', 'Transferência']

export default function PagamentoForm({
  estudioSlug,
  clienteId,
  planos,
  action,
  error,
  clienteNif = null,
  validadeAtual = null,
}: {
  estudioSlug: string
  clienteId: string
  planos: Plano[]
  action: (formData: FormData) => void
  error?: string
  clienteNif?: string | null
  validadeAtual?: string | null
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const fimEsteMes = fimDoMes(hoje)
  const fimProximoMes = fimDoMes(hoje, 1)
  const [planoId, setPlanoId] = useState('')
  const [valor, setValor] = useState('')
  const [desconto, setDesconto] = useState('')
  const [validoAte, setValidoAte] = useState(validadeSugerida(hoje, validadeAtual))
  // A maior parte dos pagamentos pede fatura — vem já marcado, para não
  // ser preciso clicar sempre; mesmo assim, ao guardar confirma-se
  // sempre (abaixo), para nunca sair um pedido sem o instrutor dar por
  // isso conscientemente.
  const [pedirFatura, setPedirFatura] = useState(true)
  const { marcarSujo } = useAvisoSairSemGuardar()

  // Valor e desconto seguem sempre o preço do plano um em função do
  // outro (valor = preço - desconto, e vice-versa) — editar qualquer
  // um dos dois atualiza o outro; continuam ambos editáveis à mão
  // para qualquer outro caso (ex.: pagamento parcial).
  const arred = (n: number) => Math.round(n * 100) / 100

  const calcularValor = (valorPlano: number, descontoStr: string) => {
    const d = Number(descontoStr.replace(',', '.')) || 0
    return String(arred(valorPlano - d))
  }

  const calcularDesconto = (valorPlano: number, valorStr: string) => {
    const v = Number(valorStr.replace(',', '.')) || 0
    return String(Math.max(0, arred(valorPlano - v)))
  }

  const escolherPlano = (id: string) => {
    setPlanoId(id)
    const plano = planos.find((p) => p.id === id)
    if (plano) setValor(calcularValor(plano.valor, desconto))
  }

  const mudarDesconto = (novoDesconto: string) => {
    setDesconto(novoDesconto)
    const plano = planos.find((p) => p.id === planoId)
    if (plano) setValor(calcularValor(plano.valor, novoDesconto))
  }

  const mudarValor = (novoValor: string) => {
    setValor(novoValor)
    const plano = planos.find((p) => p.id === planoId)
    if (plano) setDesconto(calcularDesconto(plano.valor, novoValor))
  }

  // Pergunta sempre, mesmo com a checkbox já marcada — a resposta é que
  // decide o que realmente se envia, não a checkbox (que é só para não
  // ter de se escrever o NIF/nota de propósito antes de confirmar).
  function aoGuardar(formData: FormData) {
    const querFatura = window.confirm(
      'Pedir fatura à Administração para este pagamento?\n\n"OK" pede a fatura (o normal) · "Cancelar" regista o pagamento sem pedir fatura.'
    )
    formData.set('pedir_fatura', querFatura ? 'on' : '')
    return action(formData)
  }

  return (
    <form action={aoGuardar} onChange={marcarSujo} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="cliente_id" value={clienteId} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Plano</label>
          <select
            name="plano_id"
            required
            value={planoId}
            onChange={(e) => escolherPlano(e.target.value)}
            className={inputCls}
          >
            <option value="">— escolhe um plano —</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.valor}€
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Valor (€)</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            required
            value={valor}
            onChange={(e) => mudarValor(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Desconto (€)</label>
          <input
            name="desconto"
            type="number"
            step="0.01"
            min="0"
            value={desconto}
            onChange={(e) => mudarDesconto(e.target.value)}
            placeholder="0,00"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Método</label>
          <select name="metodo" required defaultValue="" className={inputCls}>
            <option value="">— escolhe um método —</option>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Data do pagamento</label>
          {/* Sempre o dia de hoje, o dia em que o pagamento está a ser
              registado — não é um campo editável (ver pedido do dono). */}
          <input type="hidden" name="data_pagamento" value={hoje} />
          <input
            type="date"
            value={hoje}
            readOnly
            disabled
            className={`${inputCls} cursor-not-allowed opacity-60`}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Válido até</label>
          <input
            name="valido_ate"
            type="date"
            required
            value={validoAte}
            onChange={(e) => setValidoAte(e.target.value)}
            className={inputCls}
          />
          <div className="mt-0.5 flex gap-1">
            {[
              { label: 'Este mês', valor: fimEsteMes },
              { label: 'Próximo mês', valor: fimProximoMes },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  setValidoAte(o.valor)
                  marcarSujo()
                }}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  validoAte === o.valor
                    ? 'border-brand bg-brand text-black'
                    : 'border-zinc-300 text-zinc-600 dark:border-white/20 dark:text-zinc-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-700 dark:text-zinc-300">
        <label className="flex items-center gap-1">
          <input type="checkbox" name="inclui_inscricao" /> Inclui inscrição
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="inclui_seguro" /> Inclui seguro
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="inclui_reativacao" /> Inclui reativação
        </label>
      </div>

      <div className="flex flex-col gap-0.5">
        <label className={labelCls}>Nota</label>
        <textarea name="nota" rows={1} className={inputCls} />
      </div>

      {/* Pedir fatura: não emite nada — só avisa a Administração, que
          revê o rascunho pré-preenchido e decide se a fatura sai. */}
      <div className="rounded-lg border border-border-subtle p-2">
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="pedir_fatura"
            checked={pedirFatura}
            onChange={(e) => setPedirFatura(e.target.checked)}
          />
          Pedir fatura à Administração
        </label>
        {pedirFatura && (
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>NIF do cliente</label>
              <input
                name="nif"
                inputMode="numeric"
                maxLength={11}
                defaultValue={clienteNif ?? ''}
                placeholder="Em branco = consumidor final"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>Nota para a Administração</label>
              <input name="nota_fatura" placeholder="Opcional" className={inputCls} />
            </div>
          </div>
        )}
      </div>

      <SubmitButton
        pendingText="A guardar…"
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
      >
        Registar pagamento
      </SubmitButton>
    </form>
  )
}
