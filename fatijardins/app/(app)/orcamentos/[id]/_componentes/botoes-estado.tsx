"use client"

import { useTransition } from "react"
import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, SendIcon, Undo2Icon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { Confirmar } from "@/app/(app)/trabalhos/[id]/_componentes/confirmar"
import { Button } from "@/components/ui/button"
import type { ResultadoAcao } from "@/lib/acoes"
import {
  ACAO_ESTADO_ORCAMENTO,
  podeMudarEstado,
  TRANSICOES_ORCAMENTO,
  type EstadoOrcamento,
} from "@/lib/orcamentos"
import { mudarEstadoOrcamento } from "../../_componentes/acoes"

const ICONE_ESTADO: Record<EstadoOrcamento, LucideIcon> = {
  rascunho: Undo2Icon,
  enviado: SendIcon,
  aceite: CircleCheckIcon,
  recusado: CircleXIcon,
}

type Props = {
  orcamentoId: string
  estado: EstadoOrcamento
  convertido: boolean
  /** "2026/0002" e o total formatado, para as confirmações. */
  numero: string
  total: string
}

/** Mudanças de estado possíveis (só o gerente); aceitar e recusar pedem confirmação. */
export function BotoesEstado({ orcamentoId, estado, convertido, numero, total }: Props) {
  const [aCorrer, iniciar] = useTransition()
  const destinos = TRANSICOES_ORCAMENTO[estado].filter((para) => podeMudarEstado(estado, para, convertido))

  function mudar(para: EstadoOrcamento) {
    iniciar(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await mudarEstadoOrcamento(orcamentoId, para)
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      if (!resultado.ok) toast.error(resultado.erro)
      else toast.success(resultado.mensagem ?? "Estado alterado.")
    })
  }

  return destinos.map((para) => {
    const Icone = ICONE_ESTADO[para]
    // O passo seguinte natural é o botão principal.
    const principal = (estado === "rascunho" && para === "enviado") || para === "aceite"
    const comConfirmacao = para === "aceite" || para === "recusado"
    const botao = (
      <Button
        key={para}
        variant={principal ? "default" : "outline"}
        size="lg"
        disabled={aCorrer}
        onClick={comConfirmacao ? undefined : () => mudar(para)}
      >
        {aCorrer ? <LoaderCircleIcon className="animate-spin" /> : <Icone />}
        {ACAO_ESTADO_ORCAMENTO[para]}
      </Button>
    )
    if (para === "aceite") {
      return (
        <Confirmar
          key={para}
          gatilho={botao}
          titulo="Marcar como aceite?"
          descricao={
            <>
              O cliente aceitou o orçamento <strong>{numero}</strong> ({total}). Depois pode convertê-lo em trabalho
              para o pôr na agenda.
            </>
          }
          confirmar={ACAO_ESTADO_ORCAMENTO.aceite}
          variante="default"
          acao={() => mudarEstadoOrcamento(orcamentoId, "aceite")}
        />
      )
    }
    if (para === "recusado") {
      return (
        <Confirmar
          key={para}
          gatilho={botao}
          titulo="Marcar como recusado?"
          descricao={
            <>
              O orçamento <strong>{numero}</strong> fica registado como recusado pelo cliente. Pode voltar a pô-lo em
              rascunho para o alterar e enviar de novo.
            </>
          }
          confirmar={ACAO_ESTADO_ORCAMENTO.recusado}
          acao={() => mudarEstadoOrcamento(orcamentoId, "recusado")}
        />
      )
    }
    return botao
  })
}
