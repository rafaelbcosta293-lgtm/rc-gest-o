"use client"

import { useState } from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Confirmar } from "@/app/(app)/trabalhos/[id]/_componentes/confirmar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/formatar"
import { NOMES_TIPO_MANUTENCAO } from "@/lib/recursos"
import { apagarManutencao } from "./acoes"
import { FormularioManutencao, type Manutencao, type PrazosEquipamento } from "./formulario-manutencao"

type Props = {
  equipamentoId: string
  viatura: boolean
  prazos: PrazosEquipamento
  hoje: string
  /** Das mais recentes para as mais antigas. */
  manutencoes: Manutencao[]
}

/** Manutenções do equipamento (só o gerente): lista, totais e registar, editar e apagar. */
export function Manutencoes({ equipamentoId, viatura, prazos, hoje, manutencoes }: Props) {
  // Manutenção em edição ("nova" = registar).
  const [aEditar, setAEditar] = useState<string | null>(null)

  const ano = hoje.slice(0, 4)
  const totalAno = manutencoes.filter((m) => m.data.startsWith(ano)).reduce((soma, m) => soma + (m.custo ?? 0), 0)
  const total = manutencoes.reduce((soma, m) => soma + (m.custo ?? 0), 0)
  const unidade = viatura ? "km" : "h"

  return (
    <div className="grid gap-4">
      <dl aria-label="Total gasto" className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl bg-muted/60 p-3">
          <dt className="text-sm text-muted-foreground">Gasto em {ano}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatarMoeda(totalAno)}</dd>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <dt className="text-sm text-muted-foreground">Desde sempre</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatarMoeda(total)}</dd>
        </div>
      </dl>

      {aEditar === "nova" ? (
        <FormularioManutencao
          equipamentoId={equipamentoId}
          viatura={viatura}
          prazos={prazos}
          hoje={hoje}
          aoTerminar={() => setAEditar(null)}
        />
      ) : (
        <Button
          type="button"
          size="lg"
          variant={manutencoes.length === 0 ? "default" : "outline"}
          className="w-full sm:w-fit"
          disabled={aEditar !== null}
          onClick={() => setAEditar("nova")}
        >
          <PlusIcon />
          Registar manutenção
        </Button>
      )}

      {manutencoes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Ainda não há manutenções registadas. Registe as revisões, reparações, inspeções e seguros para saber quanto
          custa este equipamento.
        </p>
      ) : (
        <ul className="divide-y" aria-label="Manutenções">
          {manutencoes.map((manutencao) => {
            if (aEditar === manutencao.id) {
              return (
                <li key={manutencao.id} className="py-3">
                  <FormularioManutencao
                    key={manutencao.updated_at}
                    equipamentoId={equipamentoId}
                    viatura={viatura}
                    prazos={prazos}
                    hoje={hoje}
                    manutencao={manutencao}
                    aoTerminar={() => setAEditar(null)}
                  />
                </li>
              )
            }
            const nomeTipo = NOMES_TIPO_MANUTENCAO[manutencao.tipo]
            const detalhes = [
              manutencao.contador !== null && `${formatarNumero(manutencao.contador)} ${unidade}`,
              manutencao.autor && `Registada por ${manutencao.autor}`,
            ].filter(Boolean)
            return (
              <li key={manutencao.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium tabular-nums">{formatarData(manutencao.data)}</span>
                      <Badge variant="secondary">{nomeTipo}</Badge>
                    </p>
                    <p className="shrink-0 font-semibold tabular-nums">
                      {manutencao.custo === null ? (
                        <span className="font-normal text-muted-foreground">Sem custo</span>
                      ) : (
                        formatarMoeda(manutencao.custo)
                      )}
                    </p>
                  </div>
                  {manutencao.descricao && <p className="mt-1 break-words whitespace-pre-line">{manutencao.descricao}</p>}
                  {detalhes.length > 0 && (
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{detalhes.join(" · ")}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 sm:size-10"
                    title="Editar"
                    disabled={aEditar !== null}
                    onClick={() => setAEditar(manutencao.id)}
                  >
                    <PencilIcon />
                    <span className="sm:sr-only">Editar</span>
                  </Button>
                  <Confirmar
                    gatilho={
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 text-destructive hover:text-destructive sm:size-10"
                        title="Apagar"
                        disabled={aEditar !== null}
                      >
                        <Trash2Icon />
                        <span className="sm:sr-only">Apagar</span>
                      </Button>
                    }
                    titulo="Apagar esta manutenção?"
                    descricao={
                      <>
                        Vai apagar a manutenção de {formatarData(manutencao.data)} ({nomeTipo}
                        {manutencao.custo !== null && `, ${formatarMoeda(manutencao.custo)}`}). As datas do
                        equipamento (revisão, seguro, IPO) não mudam. Esta ação não pode ser desfeita.
                      </>
                    }
                    confirmar="Apagar"
                    acao={() => apagarManutencao(equipamentoId, manutencao.id)}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
