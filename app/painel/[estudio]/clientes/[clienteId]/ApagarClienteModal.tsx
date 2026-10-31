'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import SubmitButton from '@/components/SubmitButton'
import { apagarCliente } from '../actions'

export type ContagensCliente = {
  pagamentos: number
  sessoes: number
  avaliacoes: number
  presencas: number
}

// Eliminar um cliente apaga para sempre o histórico todo (pagamentos,
// treinos, avaliações, presenças) — por isso são sempre precisos dois
// passos, de propósito bem mais pesados que um simples window.confirm():
// primeiro ver o que se perde, só depois escrever o nome exato do
// cliente para o botão final sequer ficar ativo.
export default function ApagarClienteModal({
  slug,
  clienteId,
  clienteNome,
  contagens,
}: {
  slug: string
  clienteId: string
  clienteNome: string
  contagens: ContagensCliente
}) {
  const [passo, setPasso] = useState<'fechado' | 'aviso' | 'confirmar'>('fechado')
  const [nomeEscrito, setNomeEscrito] = useState('')

  function fechar() {
    setPasso('fechado')
    setNomeEscrito('')
  }

  const itens = [
    { n: contagens.pagamentos, label: 'pagamento' },
    { n: contagens.sessoes, label: 'sessão de treino' },
    { n: contagens.avaliacoes, label: 'avaliação física' },
    { n: contagens.presencas, label: 'registo de presença' },
  ].filter((i) => i.n > 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setPasso('aviso')}
        className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-4 py-2 text-sm font-bold text-muted hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4" /> Eliminar cliente
      </button>

      {passo !== 'fechado' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={fechar}>
          <div
            className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Eliminar {clienteNome}</h2>
              <button
                type="button"
                onClick={fechar}
                className="rounded-full p-1 text-muted hover:bg-brand/[.06] hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {passo === 'aviso' && (
              <>
                <p className="mt-3 text-sm text-foreground">
                  Esta ação não pode ser desfeita. Além da ficha, apaga também para sempre:
                </p>
                {itens.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-red-700 dark:text-red-300">
                    {itens.map((i) => (
                      <li key={i.label}>
                        {i.n} {i.label}
                        {i.n === 1 ? '' : 's'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    Este cliente ainda não tem pagamentos, treinos, avaliações nem presenças registados.
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">
                  Eventos futuros na agenda e leads ligadas a este cliente não são apagados, mas deixam de
                  ter o nome associado.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fechar}
                    className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-foreground/[.06]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasso('confirmar')}
                    className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}

            {passo === 'confirmar' && (
              <form action={apagarCliente}>
                <input type="hidden" name="estudio_slug" value={slug} />
                <input type="hidden" name="id" value={clienteId} />
                <p className="mt-3 text-sm text-foreground">
                  Para confirmar, escreve o nome <strong>{clienteNome}</strong> exatamente como aparece:
                </p>
                <input
                  autoFocus
                  value={nomeEscrito}
                  onChange={(e) => setNomeEscrito(e.target.value)}
                  placeholder={clienteNome}
                  className="mt-2 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-red-400"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fechar}
                    className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-foreground/[.06]"
                  >
                    Cancelar
                  </button>
                  <SubmitButton
                    pendingText="A eliminar…"
                    disabled={nomeEscrito !== clienteNome}
                    className="rounded-full border border-red-300 bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800"
                  >
                    Eliminar definitivamente
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
