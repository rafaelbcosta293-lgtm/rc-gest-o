'use client'

import { useState } from 'react'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'
import SubmitButton from '@/components/SubmitButton'
import {
  IVA_POR_OMISSAO,
  ROTULO_TIPO_LINHA,
  arredondar,
  nifValido,
  type LinhaRascunho,
  type RascunhoFatura,
  type TipoLinhaFatura,
} from '@/lib/data/faturas'
import type { ProdutoZsgo, MetodoPagamentoZsgo } from '@/lib/zsgo'

const inputCls =
  'w-full rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none focus:border-white/30 dark:bg-zinc-900'
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-muted'

const fmtEuro = (n: number) =>
  n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default function FaturaEditor({
  id,
  rascunho,
  valorPago,
  produtos,
  metodos,
  guardarAction,
  emitirAction,
}: {
  id: string
  rascunho: RascunhoFatura
  valorPago: number
  produtos: ProdutoZsgo[] | null
  metodos: MetodoPagamentoZsgo[] | null
  guardarAction: (fd: FormData) => void
  emitirAction: (fd: FormData) => void
}) {
  const [linhas, setLinhas] = useState<LinhaRascunho[]>(rascunho.linhas)
  const [nif, setNif] = useState(rascunho.cliente.nif ?? '')
  // Marcado de origem quando o pedido já chegou sem NIF (cliente não quis
  // dar). Também se pode marcar aqui, mesmo que já haja um NIF escrito —
  // a fatura sai sempre a consumidor final enquanto estiver marcado.
  const [semNif, setSemNif] = useState(!rascunho.cliente.nif)
  const [tipoDoc, setTipoDoc] = useState(rascunho.documento.tipo)

  const total = arredondar(linhas.reduce((s, l) => s + (l.quantidade || 0) * (l.preco_com_iva || 0), 0))
  const diferenca = arredondar(total - valorPago)
  const nifLimpo = semNif ? '' : nif.replace(/\D/g, '')
  const nifInvalido = nifLimpo !== '' && !nifValido(nifLimpo)

  function mudar(i: number, campo: keyof LinhaRascunho, valor: string) {
    setLinhas((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l
        if (campo === 'quantidade' || campo === 'preco_com_iva' || campo === 'iva') {
          return { ...l, [campo]: Number(valor.replace(',', '.')) }
        }
        if (campo === 'produto_referencia') {
          // Ao escolher o artigo, a taxa de IVA passa a ser a do artigo no ZS Go.
          const p = produtos?.find((x) => x.referencia === valor)
          return { ...l, produto_referencia: valor || null, iva: p?.iva ?? l.iva }
        }
        return { ...l, [campo]: valor }
      })
    )
  }

  const resumoLinhas = linhas.length
    ? `${linhas[0].descricao || '(sem descrição)'}${linhas.length > 1 ? ` +${linhas.length - 1} linha(s)` : ''}`
    : 'Sem linhas'
  const faltaArtigo = linhas.some((l) => !l.produto_referencia)

  return (
    <form className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />

      {/* Linha única por omissão (pedido do dono: com 50 pedidos por
          validar, o ecrã não pode ter uma página inteira por cada um) —
          o "+" abre tudo o resto para editar quando é preciso. */}
      <div className="flex flex-wrap items-center gap-2">
        <details className="group min-w-0 flex-1">
          <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 text-sm select-none">
            <Plus className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-45" />
            <span className="min-w-0 truncate">{resumoLinhas}</span>
            <strong className="shrink-0 font-mono">{fmtEuro(total)}</strong>
            <span className="shrink-0 text-xs text-muted">
              NIF {semNif ? '— consumidor final' : nifLimpo || '—'}
            </span>
            {faltaArtigo && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-amber-500">
                <TriangleAlert className="h-3 w-3" /> artigo por escolher
              </span>
            )}
            {Math.abs(diferenca) >= 0.01 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-amber-500">
                <TriangleAlert className="h-3 w-3" /> diferença {fmtEuro(diferenca)}
              </span>
            )}
            {nifInvalido && <span className="shrink-0 text-xs text-red-500">NIF inválido</span>}
          </summary>

          <div className="mt-2 flex flex-col gap-2 border-t border-border-subtle pt-2">
            {/* Cliente — só nome/NIF à vista; o resto atrás do "+" de baixo */}
            <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-6">
              <div className="flex flex-col gap-0.5 sm:col-span-3">
                <label className={labelCls}>Nome na fatura</label>
                <input name="cliente_nome" defaultValue={rascunho.cliente.nome} required className={inputCls} />
              </div>
              <div className="flex flex-col gap-0.5 sm:col-span-3">
                <label className={labelCls}>NIF {semNif && <span className="normal-case">(consumidor final)</span>}</label>
                <input
                  name="cliente_nif"
                  value={semNif ? '' : nif}
                  onChange={(e) => setNif(e.target.value)}
                  disabled={semNif}
                  inputMode="numeric"
                  maxLength={11}
                  className={`${inputCls} ${nifInvalido ? 'border-red-500' : ''} ${semNif ? 'opacity-50' : ''}`}
                />
                {nifInvalido && <span className="text-xs text-red-500">NIF inválido.</span>}
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={semNif}
                    onChange={(e) => setSemNif(e.target.checked)}
                  />
                  Sem NIF — o cliente não quis dar (fatura a consumidor final, só até 1000 €)
                </label>
              </div>
            </fieldset>

            <details className="group/detalhes rounded-lg border border-border-subtle">
              <summary className="flex cursor-pointer list-none items-center gap-1 px-2 py-1.5 text-xs font-semibold text-muted select-none hover:text-foreground">
                <Plus className="h-3.5 w-3.5 transition-transform group-open/detalhes:rotate-45" />
                Mais detalhes — morada, documento, método de pagamento
              </summary>
              <div className="flex flex-col gap-2 border-t border-border-subtle p-2">
                {/* Cliente — morada */}
                <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                  <div className="flex flex-col gap-0.5 sm:col-span-3">
                    <label className={labelCls}>Morada</label>
                    <input name="cliente_morada" defaultValue={rascunho.cliente.morada ?? ''} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-1">
                    <label className={labelCls}>Cód. postal</label>
                    <input name="cliente_codigo_postal" defaultValue={rascunho.cliente.codigo_postal ?? ''} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <label className={labelCls}>Cidade</label>
                    <input name="cliente_cidade" defaultValue={rascunho.cliente.cidade ?? ''} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-3">
                    <label className={labelCls}>Email</label>
                    <input name="cliente_email" type="email" defaultValue={rascunho.cliente.email ?? ''} className={inputCls} />
                  </div>
                </fieldset>

                {/* Documento */}
                <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <label className={labelCls}>Documento</label>
                    <select
                      name="documento_tipo"
                      value={tipoDoc}
                      onChange={(e) => setTipoDoc(e.target.value === 'FA' ? 'FA' : 'FR')}
                      className={inputCls}
                    >
                      <option value="FR">Fatura-Recibo (já pago)</option>
                      <option value="FA">Fatura</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <label className={labelCls}>Data</label>
                    <input name="documento_data" type="date" defaultValue={rascunho.documento.data} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <label className={labelCls}>
                      Pagamento {rascunho.documento.metodo ? `(na app: ${rascunho.documento.metodo})` : ''}
                    </label>
                    <input type="hidden" name="documento_metodo" value={rascunho.documento.metodo ?? ''} />
                    {metodos ? (
                      <select
                        name="documento_zsgo_metodo_id"
                        defaultValue={rascunho.documento.zsgo_metodo_id ?? ''}
                        className={inputCls}
                      >
                        <option value="">— escolhe —</option>
                        {metodos.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name="documento_zsgo_metodo_id"
                        defaultValue={rascunho.documento.zsgo_metodo_id ?? ''}
                        placeholder="ID do método no ZS Go"
                        className={inputCls}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 sm:col-span-6">
                    <label className={labelCls}>Observações na fatura</label>
                    <input name="documento_notas" defaultValue={rascunho.documento.notas ?? ''} className={inputCls} />
                  </div>
                </fieldset>
              </div>
            </details>

            {/* Linhas */}
            <div className="flex flex-col gap-1.5">
              <div className="hidden grid-cols-12 gap-2 sm:grid">
                <span className={`${labelCls} col-span-2`}>Tipo</span>
                <span className={`${labelCls} col-span-3`}>Artigo ZS Go</span>
                <span className={`${labelCls} col-span-3`}>Descrição na linha</span>
                <span className={`${labelCls} col-span-1`}>Qtd.</span>
                <span className={`${labelCls} col-span-1`}>Preço c/ IVA</span>
                <span className={`${labelCls} col-span-1`}>IVA %</span>
              </div>
              {linhas.map((l, i) => (
                <div key={i} className="grid grid-cols-2 gap-1.5 rounded-lg border border-border-subtle p-1.5 sm:grid-cols-12 sm:border-0 sm:p-0">
                  <select
                    name="linha_tipo"
                    value={l.tipo}
                    onChange={(e) => mudar(i, 'tipo', e.target.value)}
                    className={`${inputCls} sm:col-span-2`}
                  >
                    {(Object.keys(ROTULO_TIPO_LINHA) as TipoLinhaFatura[]).map((t) => (
                      <option key={t} value={t}>
                        {ROTULO_TIPO_LINHA[t]}
                      </option>
                    ))}
                  </select>
                  {produtos ? (
                    <select
                      name="linha_produto"
                      value={l.produto_referencia ?? ''}
                      onChange={(e) => mudar(i, 'produto_referencia', e.target.value)}
                      className={`${inputCls} sm:col-span-3 ${l.produto_referencia ? '' : 'border-amber-500'}`}
                    >
                      <option value="">— escolhe o artigo —</option>
                      {produtos.map((p) => (
                        <option key={p.referencia} value={p.referencia}>
                          {p.descricao} ({p.referencia}){p.iva != null ? ` · ${p.iva}%` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="linha_produto"
                      value={l.produto_referencia ?? ''}
                      onChange={(e) => mudar(i, 'produto_referencia', e.target.value)}
                      placeholder="Referência do artigo"
                      className={`${inputCls} sm:col-span-3`}
                    />
                  )}
                  <input
                    name="linha_descricao"
                    value={l.descricao}
                    onChange={(e) => mudar(i, 'descricao', e.target.value)}
                    className={`${inputCls} col-span-2 sm:col-span-3`}
                  />
                  <input
                    name="linha_quantidade"
                    type="number"
                    step="1"
                    min="1"
                    value={l.quantidade}
                    onChange={(e) => mudar(i, 'quantidade', e.target.value)}
                    className={`${inputCls} sm:col-span-1`}
                  />
                  <input
                    name="linha_preco"
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.preco_com_iva}
                    onChange={(e) => mudar(i, 'preco_com_iva', e.target.value)}
                    className={`${inputCls} sm:col-span-1`}
                  />
                  <div className="flex items-center gap-1 sm:col-span-2">
                    <select
                      name="linha_iva"
                      value={l.iva}
                      onChange={(e) => mudar(i, 'iva', e.target.value)}
                      className={inputCls}
                    >
                      {[23, 13, 6, 0].map((t) => (
                        <option key={t} value={t}>
                          {t}%
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Remover linha"
                      onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
                      className="rounded-md p-1.5 text-muted hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setLinhas((ls) => [
                    ...ls,
                    { tipo: 'outro', descricao: '', produto_referencia: null, quantidade: 1, preco_com_iva: 0, iva: IVA_POR_OMISSAO },
                  ])
                }
                className="inline-flex items-center gap-1 self-start text-xs font-semibold text-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar linha
              </button>
            </div>

            {/* Totais */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  Total da fatura: <strong className="font-mono">{fmtEuro(total)}</strong>
                </span>
                <span className="text-muted">Valor pago: {fmtEuro(valorPago)}</span>
                {Math.abs(diferenca) >= 0.01 && (
                  <span className="inline-flex items-center gap-1 text-amber-500">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Diferença de {fmtEuro(diferenca)}
                  </span>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" name="documento_enviar_email" defaultChecked={rascunho.documento.enviar_email} />
                Enviar PDF por email ao cliente
              </label>
            </div>

            <SubmitButton
              formAction={guardarAction}
              pendingText="A guardar…"
              className="self-start rounded-full border border-border-strong px-4 py-2 text-sm font-semibold hover:bg-foreground/[.08]"
            >
              Guardar rascunho
            </SubmitButton>
          </div>
        </details>

        <SubmitButton
          formAction={emitirAction}
          pendingText="A emitir no ZS Go…"
          disabled={nifInvalido || linhas.length === 0}
          onClick={(e) => {
            const tipo = tipoDoc === 'FR' ? 'Fatura-Recibo' : 'Fatura'
            if (
              !window.confirm(
                `Emitir ${tipo} de ${fmtEuro(total)} no ZS Go?\n\nFica comunicada às Finanças e não pode ser apagada — só anulada com nota de crédito.`
              )
            ) {
              e.preventDefault()
            }
          }}
          className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong"
        >
          Emitir
        </SubmitButton>
      </div>
    </form>
  )
}
