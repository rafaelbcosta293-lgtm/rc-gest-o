"use client"

import { useState } from "react"
import { BanknoteIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Confirmar } from "@/app/(app)/trabalhos/[id]/_componentes/confirmar"
import { Button } from "@/components/ui/button"
import { NOMES_METODO_PAGAMENTO } from "@/lib/financas"
import { formatarData, formatarMoeda } from "@/lib/formatar"
import { apagarPagamento } from "./acoes"
import { FormularioPagamento, type PagamentoLista } from "./formulario-pagamento"

/** Botão grande "Registar pagamento", que abre o formulário por baixo. */
export function RegistarPagamento({ cobrancaId, hoje, emDivida }: { cobrancaId: string; hoje: string; emDivida: number }) {
  const [aberto, setAberto] = useState(false)
  if (aberto) {
    return <FormularioPagamento cobrancaId={cobrancaId} hoje={hoje} emDivida={emDivida} aoTerminar={() => setAberto(false)} />
  }
  return (
    <Button type="button" size="lg" className="w-full sm:w-fit" onClick={() => setAberto(true)}>
      <BanknoteIcon />
      Registar pagamento
    </Button>
  )
}

type Props = {
  cobrancaId: string
  hoje: string
  /** Dos mais recentes para os mais antigos. */
  pagamentos: PagamentoLista[]
}

/** Pagamentos recebidos de uma cobrança, com editar e apagar. */
export function ListaPagamentos({ cobrancaId, hoje, pagamentos }: Props) {
  const [aEditar, setAEditar] = useState<string | null>(null)
  const fechar = () => setAEditar(null)

  if (pagamentos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Ainda não há pagamentos desta cobrança.
      </p>
    )
  }

  return (
    <ul className="divide-y" aria-label="Pagamentos">
      {pagamentos.map((pagamento) => {
        if (aEditar === pagamento.id) {
          return (
            <li key={pagamento.id} className="py-3">
              <FormularioPagamento
                key={pagamento.updatedAt}
                cobrancaId={cobrancaId}
                hoje={hoje}
                emDivida={0}
                pagamento={pagamento}
                aoTerminar={fechar}
              />
            </li>
          )
        }
        const valor = formatarMoeda(pagamento.valor)
        return (
          <li key={pagamento.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium tabular-nums">{formatarData(pagamento.data)}</span>
                  <span className="text-muted-foreground">{NOMES_METODO_PAGAMENTO[pagamento.metodo]}</span>
                </p>
                {pagamento.referencia && <p className="mt-1 break-words">Ref.: {pagamento.referencia}</p>}
                {pagamento.notas && <p className="mt-1 break-words whitespace-pre-line">{pagamento.notas}</p>}
                {pagamento.autor && <p className="mt-1 text-xs text-muted-foreground">Registado por {pagamento.autor}</p>}
              </div>
              <p className="shrink-0 text-right text-lg font-semibold whitespace-nowrap text-primary tabular-nums">{valor}</p>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                disabled={aEditar !== null}
                onClick={() => setAEditar(pagamento.id)}
              >
                <PencilIcon />
                Editar
              </Button>
              <Confirmar
                gatilho={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 text-destructive hover:text-destructive md:h-9"
                    disabled={aEditar !== null}
                  >
                    <Trash2Icon />
                    Apagar
                  </Button>
                }
                titulo="Apagar este pagamento?"
                descricao={
                  <>
                    Vai apagar o pagamento de <strong>{valor}</strong> de {formatarData(pagamento.data)}. O valor volta a
                    ficar em dívida.
                  </>
                }
                confirmar="Apagar"
                acao={() => apagarPagamento(pagamento.id)}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
