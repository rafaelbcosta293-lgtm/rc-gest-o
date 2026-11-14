'use client'

import { useState } from 'react'
import SubmitButton from '@/components/SubmitButton'
import ClienteCombobox, { type ClienteOpcao } from '@/components/ClienteCombobox'

export type ProdutoVenda = { id: string; nome: string; valor: number; categoria: string }

const METODOS = ['Numerário', 'Multibanco', 'MB Way', 'Transferência']
const inputCls =
  'rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30'
const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-zinc-500'

const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`

// Venda de um produto (bar, merchandising…): escolhe-se o produto e a
// quantidade, o total calcula-se sozinho (pode ser corrigido, ex.: uma
// oferta) e o cliente é opcional — há vendas a quem não é cliente.
export default function VendaProdutoForm({
  slug,
  estudioId,
  produtos,
  clientes,
  action,
}: {
  slug: string
  estudioId: number
  produtos: ProdutoVenda[]
  clientes: ClienteOpcao[]
  action: (formData: FormData) => void
}) {
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  // null = total automático (preço × quantidade).
  const [totalManual, setTotalManual] = useState<string | null>(null)

  const produto = produtos.find((p) => p.id === produtoId)
  const automatico = produto ? Math.round(produto.valor * quantidade * 100) / 100 : 0
  const categorias = [...new Set(produtos.map((p) => p.categoria))]

  return (
    <form action={action} className="rounded-xl border border-border-subtle bg-surface p-4">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="estudio_id" value={estudioId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_90px_120px_1fr_1.5fr_auto] lg:items-end">
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Produto</label>
          <select
            name="produto_id"
            required
            value={produtoId}
            onChange={(e) => {
              setProdutoId(e.target.value)
              setTotalManual(null)
            }}
            className={inputCls}
          >
            <option value="">— escolhe um produto —</option>
            {categorias.map((c) => (
              <optgroup key={c} label={c}>
                {produtos
                  .filter((p) => p.categoria === c)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} · {eur(p.valor)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Quant.</label>
          <input
            name="quantidade"
            type="number"
            min={1}
            max={999}
            required
            value={quantidade}
            onChange={(e) => {
              setQuantidade(Math.max(1, Number(e.target.value) || 1))
              setTotalManual(null)
            }}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Total (€)</label>
          <input
            name="valor"
            inputMode="decimal"
            required
            value={totalManual ?? (produto ? automatico.toFixed(2).replace('.', ',') : '')}
            onChange={(e) => setTotalManual(e.target.value)}
            placeholder="0,00"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Método</label>
          <select name="metodo" required defaultValue="" className={inputCls}>
            <option value="">— escolhe —</option>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Cliente (opcional)</label>
          <ClienteCombobox clientes={clientes} placeholder="Sem cliente — escreve para associar" />
        </div>
        <SubmitButton pendingText="A registar…" className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black hover:bg-brand-strong">
          Registar venda
        </SubmitButton>
      </div>
    </form>
  )
}
