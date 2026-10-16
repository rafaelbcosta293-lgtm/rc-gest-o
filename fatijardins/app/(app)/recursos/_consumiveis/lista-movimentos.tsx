"use client"

import { useState } from "react"
import Link from "next/link"
import { PencilIcon, Trash2Icon } from "lucide-react"

import { Confirmar } from "@/app/(app)/trabalhos/[id]/_componentes/confirmar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatarData, formatarMoeda } from "@/lib/formatar"
import { NOMES_TIPO_MOVIMENTO, type TipoMovimentoStock } from "@/lib/recursos"
import { cn } from "@/lib/utils"
import { apagarMovimento } from "./acoes"
import {
  FormularioEditarAcerto,
  FormularioEntrada,
  FormularioSaida,
  quantidadeComSinal,
} from "./formularios-movimento"
import type { MovimentoLista, OpcaoTrabalho } from "./tipos"

const LIGACAO = "font-medium text-primary underline-offset-4 hover:underline"

/** Cor de cada tipo: entradas a verde, saídas a âmbar, acertos a azul. */
const COR_TIPO: Record<TipoMovimentoStock, string> = {
  entrada: "border-transparent bg-secondary text-secondary-foreground",
  saida: "border-amber-400 text-amber-800 dark:text-amber-300",
  ajuste: "border-sky-400 text-sky-800 dark:text-sky-300",
}

const ARTIGO_TIPO: Record<TipoMovimentoStock, string> = {
  entrada: "a entrada",
  saida: "a saída",
  ajuste: "o acerto",
}

export function BadgeTipoMovimento({ tipo }: { tipo: TipoMovimentoStock }) {
  return (
    <Badge variant="outline" className={COR_TIPO[tipo]}>
      {NOMES_TIPO_MOVIMENTO[tipo]}
    </Badge>
  )
}

type Props = {
  consumivelId: string
  unidade: string
  hoje: string
  stock: number
  precoAtual: number | null
  trabalhos: OpcaoTrabalho[]
  /** Dos mais recentes para os mais antigos. */
  movimentos: MovimentoLista[]
}

/** Movimentos de stock (só o gerente); os feitos à mão editam-se e apagam-se aqui. */
export function ListaMovimentos({ consumivelId, unidade, hoje, stock, precoAtual, trabalhos, movimentos }: Props) {
  const [aEditar, setAEditar] = useState<string | null>(null)
  const fechar = () => setAEditar(null)

  if (movimentos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Ainda não há movimentos. Registe uma entrada quando comprar este consumível.
      </p>
    )
  }

  return (
    <ul className="divide-y" aria-label="Movimentos de stock">
      {movimentos.map((movimento) => {
        if (aEditar === movimento.id && !movimento.doMaterial) {
          return (
            <li key={movimento.id} className="py-3">
              {movimento.tipo === "entrada" ? (
                <FormularioEntrada
                  key={movimento.updatedAt}
                  consumivelId={consumivelId}
                  unidade={unidade}
                  hoje={hoje}
                  stock={stock}
                  precoAtual={precoAtual}
                  movimento={movimento}
                  aoTerminar={fechar}
                />
              ) : movimento.tipo === "saida" ? (
                <FormularioSaida
                  key={movimento.updatedAt}
                  consumivelId={consumivelId}
                  unidade={unidade}
                  hoje={hoje}
                  stock={stock}
                  trabalhos={trabalhos}
                  movimento={movimento}
                  aoTerminar={fechar}
                />
              ) : (
                <FormularioEditarAcerto
                  key={movimento.updatedAt}
                  unidade={unidade}
                  movimento={movimento}
                  aoTerminar={fechar}
                />
              )}
            </li>
          )
        }

        const quantidade = quantidadeComSinal(movimento.quantidade, unidade)
        return (
          <li key={movimento.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <BadgeTipoMovimento tipo={movimento.tipo} />
                  <span className="text-muted-foreground tabular-nums">{formatarData(movimento.data)}</span>
                </p>
                {movimento.doMaterial && <p className="mt-1.5 font-medium">Material gasto no trabalho</p>}
                {movimento.trabalho && (
                  <p className="mt-1 break-words">
                    <Link href={`/trabalhos/${movimento.trabalho.id}`} className={LIGACAO}>
                      {movimento.trabalho.descricao}
                    </Link>
                    <span className="block text-muted-foreground tabular-nums">
                      Trabalho de {formatarData(movimento.trabalho.data)}
                    </span>
                  </p>
                )}
                {movimento.tipo === "entrada" && movimento.precoUnitario !== null && (
                  <p className="mt-1 text-muted-foreground tabular-nums">
                    {formatarMoeda(movimento.precoUnitario)}/{unidade}
                  </p>
                )}
                {movimento.notas && <p className="mt-1 break-words whitespace-pre-line">{movimento.notas}</p>}
                {movimento.autor && (
                  <p className="mt-1 text-xs text-muted-foreground">Registado por {movimento.autor}</p>
                )}
              </div>
              <p
                className={cn(
                  "shrink-0 text-right text-lg font-semibold whitespace-nowrap tabular-nums",
                  movimento.quantidade > 0 && "text-primary"
                )}
              >
                {quantidade}
              </p>
            </div>
            {!movimento.doMaterial && (
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 md:h-9"
                  disabled={aEditar !== null}
                  onClick={() => setAEditar(movimento.id)}
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
                  titulo="Apagar este movimento?"
                  descricao={
                    <>
                      Vai apagar {ARTIGO_TIPO[movimento.tipo]} de <strong>{quantidade}</strong> de{" "}
                      {formatarData(movimento.data)}. O stock é recalculado.
                    </>
                  }
                  confirmar="Apagar"
                  acao={() => apagarMovimento(movimento.id)}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
