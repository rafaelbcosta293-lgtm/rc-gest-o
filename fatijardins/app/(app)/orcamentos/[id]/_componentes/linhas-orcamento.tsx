"use client"

import { useState, useTransition } from "react"
import { ArrowDownIcon, ArrowUpIcon, ListPlusIcon, LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Confirmar } from "@/app/(app)/trabalhos/[id]/_componentes/confirmar"
import { Button } from "@/components/ui/button"
import type { ResultadoAcao } from "@/lib/acoes"
import { formatarMoeda } from "@/lib/formatar"
import {
  calcularTotais,
  NOMES_TIPO_LINHA,
  TAXA_IVA_NORMAL,
  TIPOS_LINHA,
  totalLinha,
  type TipoLinhaOrcamento,
} from "@/lib/orcamentos"
import { cn } from "@/lib/utils"
import { apagarLinha, moverLinha } from "../../_componentes/acoes"
import { FormularioLinha, type LinhaOrcamento } from "./formulario-linha"

const formatoQuantidade = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3, useGrouping: "always" })

function taxa(valor: number) {
  return valor === 0 ? "Isento" : `${valor}%`
}

type Props = {
  orcamentoId: string
  /** Pela ordem (ordem, criação); aparecem agrupadas por tipo. */
  linhas: LinhaOrcamento[]
  editavel: boolean
}

/** Linhas do orçamento agrupadas por tipo, com os totais; em rascunho, acrescentar, editar, apagar e ordenar. */
export function LinhasOrcamento({ orcamentoId, linhas, editavel }: Props) {
  // Linha em edição ("nova" = acrescentar). Fora de rascunho nunca há edição.
  const [aEditar, setAEditar] = useState<string | null>(null)
  const [ultima, setUltima] = useState<{ tipo: TipoLinhaOrcamento; taxa: number }>({
    tipo: "mao_de_obra",
    taxa: TAXA_IVA_NORMAL,
  })
  const [aMover, iniciarMover] = useTransition()
  const [movida, setMovida] = useState<string | null>(null)
  const editando = editavel ? aEditar : null

  const grupos = TIPOS_LINHA.map((tipo) => {
    const doTipo = linhas.filter((linha) => linha.tipo === tipo)
    return { tipo, linhas: doTipo, subtotal: calcularTotais(doTipo).subtotal }
  }).filter((grupo) => grupo.linhas.length > 0)
  const totais = calcularTotais(linhas)

  function mover(linhaId: string, direcao: "cima" | "baixo") {
    setMovida(linhaId)
    iniciarMover(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await moverLinha(orcamentoId, linhaId, direcao)
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      if (!resultado.ok) toast.error(resultado.erro)
    })
  }

  const colunas = editavel
    ? "md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]"
    : "md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"

  return (
    <div className="grid gap-4">
      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {editavel
            ? "Ainda não há linhas. Acrescente a mão de obra, os materiais e o equipamento."
            : "Este orçamento não tem linhas."}
        </p>
      ) : (
        <div className={cn("grid gap-4 md:gap-x-4 md:gap-y-5", colunas)}>
          {/* Cabeçalho das colunas (só no PC). */}
          <div
            aria-hidden="true"
            className="hidden border-b pb-2 text-xs font-medium text-muted-foreground md:col-span-full md:grid md:grid-cols-subgrid"
          >
            <span>Descrição</span>
            <span className="text-right">Quantidade</span>
            <span className="text-right">Preço unit.</span>
            <span className="text-right">IVA</span>
            <span className="text-right">Total</span>
            {editavel && <span className="sr-only">Ações</span>}
          </div>

          {grupos.map((grupo) => (
            <section
              key={grupo.tipo}
              aria-labelledby={`grupo-${grupo.tipo}`}
              className="md:col-span-full md:grid md:grid-cols-subgrid"
            >
              <h3
                id={`grupo-${grupo.tipo}`}
                className="flex items-baseline justify-between gap-3 border-b pb-1.5 text-sm font-semibold text-primary md:col-span-full md:grid md:grid-cols-subgrid"
              >
                <span className="md:col-span-4">{NOMES_TIPO_LINHA[grupo.tipo]}</span>
                {/* No PC, o subtotal do grupo fica por baixo da coluna Total. */}
                <span className="text-xs font-medium text-muted-foreground tabular-nums md:text-right">
                  {formatarMoeda(grupo.subtotal)}
                </span>
              </h3>
              <ul className="divide-y md:col-span-full md:grid md:grid-cols-subgrid">
                {grupo.linhas.map((linha, i) => {
                  if (editando === linha.id) {
                    return (
                      <li key={linha.id} className="py-3 md:col-span-full">
                        <FormularioLinha
                          key={linha.updated_at}
                          orcamentoId={orcamentoId}
                          linha={linha}
                          aoTerminar={() => setAEditar(null)}
                        />
                      </li>
                    )
                  }
                  const quantidade = `${formatoQuantidade.format(linha.quantidade)} ${linha.unidade}`
                  const total = formatarMoeda(totalLinha(linha))
                  return (
                    <li
                      key={linha.id}
                      className="py-3 md:col-span-full md:grid md:grid-cols-subgrid md:items-center"
                    >
                      <div className="flex items-start justify-between gap-3 md:contents">
                        <div className="min-w-0">
                          <p className="break-words">{linha.descricao}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums md:hidden">
                            {quantidade} × {formatarMoeda(linha.preco_unitario)} · IVA {taxa(linha.taxa_iva)}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums md:hidden">{total}</p>
                      </div>
                      <p className="hidden text-right whitespace-nowrap tabular-nums md:block">{quantidade}</p>
                      <p className="hidden text-right whitespace-nowrap tabular-nums md:block">
                        {formatarMoeda(linha.preco_unitario)}
                      </p>
                      <p className="hidden text-right whitespace-nowrap tabular-nums md:block">{taxa(linha.taxa_iva)}</p>
                      <p className="hidden text-right font-medium whitespace-nowrap tabular-nums md:block">{total}</p>
                      {editavel && (
                        <div className="mt-2 grid grid-cols-[auto_auto_1fr_1fr] gap-2 md:mt-0 md:flex md:gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="size-11 md:size-9"
                            aria-label="Subir"
                            title="Subir"
                            disabled={i === 0 || aMover || editando !== null}
                            onClick={() => mover(linha.id, "cima")}
                          >
                            {aMover && movida === linha.id ? <LoaderCircleIcon className="animate-spin" /> : <ArrowUpIcon />}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="size-11 md:size-9"
                            aria-label="Descer"
                            title="Descer"
                            disabled={i === grupo.linhas.length - 1 || aMover || editando !== null}
                            onClick={() => mover(linha.id, "baixo")}
                          >
                            <ArrowDownIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 has-[>svg]:px-2 md:size-9 md:has-[>svg]:px-0"
                            title="Editar"
                            disabled={editando !== null}
                            onClick={() => setAEditar(linha.id)}
                          >
                            <PencilIcon />
                            <span className="max-[359px]:sr-only md:sr-only">Editar</span>
                          </Button>
                          <Confirmar
                            gatilho={
                              <Button
                                type="button"
                                variant="outline"
                                className="h-11 text-destructive hover:text-destructive has-[>svg]:px-2 md:size-9 md:has-[>svg]:px-0"
                                title="Apagar"
                                disabled={editando !== null}
                              >
                                <Trash2Icon />
                                <span className="max-[359px]:sr-only md:sr-only">Apagar</span>
                              </Button>
                            }
                            titulo="Apagar esta linha?"
                            descricao={
                              <>
                                Vai apagar <strong>{linha.descricao}</strong> ({total}) do orçamento.
                              </>
                            }
                            confirmar="Apagar"
                            acao={() => apagarLinha(orcamentoId, linha.id)}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editavel &&
        (editando === "nova" ? (
          <FormularioLinha
            orcamentoId={orcamentoId}
            tipoInicial={ultima.tipo}
            taxaInicial={ultima.taxa}
            aoTerminar={() => setAEditar(null)}
            aoAcrescentar={(tipo, taxaIva) => setUltima({ tipo, taxa: taxaIva })}
          />
        ) : (
          <Button
            type="button"
            size="lg"
            variant={linhas.length === 0 ? "default" : "outline"}
            className="w-full sm:w-fit"
            disabled={editando !== null}
            onClick={() => setAEditar("nova")}
          >
            {linhas.length === 0 ? <PlusIcon /> : <ListPlusIcon />}
            Acrescentar linha
          </Button>
        ))}

      <dl
        aria-label="Totais"
        className="grid gap-1.5 rounded-xl bg-muted/60 p-4 text-sm md:ml-auto md:w-96"
      >
        <div className="flex justify-between gap-4">
          <dt>Subtotal (sem IVA)</dt>
          <dd className="tabular-nums">{formatarMoeda(totais.subtotal)}</dd>
        </div>
        {totais.iva.map((iva) => (
          <div key={iva.taxa} className="flex justify-between gap-4 text-muted-foreground">
            <dt>
              {iva.taxa === 0 ? "Isento de IVA" : `IVA ${iva.taxa}%`}{" "}
              <span className="whitespace-nowrap">sobre {formatarMoeda(iva.base)}</span>
            </dt>
            <dd className="tabular-nums">{formatarMoeda(iva.valor)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-4 border-t pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatarMoeda(totais.total)}</dd>
        </div>
      </dl>
    </div>
  )
}
