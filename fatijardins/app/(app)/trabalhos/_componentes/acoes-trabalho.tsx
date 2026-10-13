"use client"

import { useLayoutEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BanIcon, LoaderCircleIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { ResultadoAcao } from "@/lib/acoes"
import type { EstadoTrabalho } from "@/lib/trabalhos"
import { apagarTrabalho, cancelarTrabalho, reativarTrabalho } from "../acoes"

type Props = {
  id: string
  titulo: string
  estado: EstadoTrabalho
  /** Quantos trabalhos agendados da mesma série vêm depois deste. */
  seguintes: number
}

/** Corre uma Server Action com notificação do resultado. */
function useAcao() {
  const router = useRouter()
  const [aCorrer, iniciar] = useTransition()

  function correr(acao: () => Promise<ResultadoAcao>, depois?: () => void) {
    iniciar(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await acao()
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success(resultado.mensagem ?? "Concluído.")
      depois?.()
      if (resultado.redirecionar) router.push(resultado.redirecionar)
    })
  }

  return { correr, aCorrer }
}

/** Cancelar / reativar / apagar o trabalho (página de edição; gerente e chefe). */
export function AcoesTrabalho({ id, titulo, estado, seguintes }: Props) {
  return (
    <>
      {(estado === "agendado" || estado === "em_curso") && <BotaoCancelar id={id} titulo={titulo} />}
      {estado === "cancelado" && <BotaoReativar id={id} />}
      {estado === "agendado" && <BotaoApagar id={id} titulo={titulo} seguintes={seguintes} />}
    </>
  )
}

/** Janela de confirmação que fecha quando o Next.js esconde a página (não voltar a encontrá-la aberta). */
function useJanela() {
  const [aberto, setAberto] = useState(false)
  useLayoutEffect(() => () => setAberto(false), [])
  return [aberto, setAberto] as const
}

function BotaoCancelar({ id, titulo }: { id: string; titulo: string }) {
  const [aberto, setAberto] = useJanela()
  const { correr, aCorrer } = useAcao()

  return (
    <AlertDialog open={aberto} onOpenChange={(abrir) => !aCorrer && setAberto(abrir)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg">
          <BanIcon />
          Cancelar trabalho
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar este trabalho?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{titulo}</strong> fica na agenda como cancelado e a equipa deixa de o ter no dia.
            Pode reativá-lo mais tarde.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={aCorrer} className="h-12">
            Voltar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="lg"
            disabled={aCorrer}
            onClick={() => correr(() => cancelarTrabalho(id), () => setAberto(false))}
          >
            {aCorrer && <LoaderCircleIcon className="animate-spin" />}
            Cancelar trabalho
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function BotaoReativar({ id }: { id: string }) {
  const { correr, aCorrer } = useAcao()
  return (
    <Button variant="outline" size="lg" disabled={aCorrer} onClick={() => correr(() => reativarTrabalho(id))}>
      {aCorrer ? <LoaderCircleIcon className="animate-spin" /> : <RotateCcwIcon />}
      Reativar
    </Button>
  )
}

function BotaoApagar({ id, titulo, seguintes }: { id: string; titulo: string; seguintes: number }) {
  const [aberto, setAberto] = useJanela()
  const [escolha, setEscolha] = useState<"este" | "seguintes" | null>(null)
  const { correr, aCorrer } = useAcao()

  function apagar(incluirSeguintes: boolean) {
    setEscolha(incluirSeguintes ? "seguintes" : "este")
    correr(() => apagarTrabalho(id, incluirSeguintes), () => setAberto(false))
  }

  return (
    <AlertDialog open={aberto} onOpenChange={(abrir) => !aCorrer && setAberto(abrir)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="text-destructive hover:text-destructive">
          <Trash2Icon />
          Apagar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar este trabalho?</AlertDialogTitle>
          <AlertDialogDescription>
            Vai apagar <strong>{titulo}</strong> da agenda. Esta ação não pode ser desfeita.
            {seguintes > 0 &&
              ` Este trabalho repete-se: pode apagar também ${seguintes === 1 ? "o seguinte" : `os ${seguintes} seguintes`} da série.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={aCorrer} className="h-12">
            Voltar
          </AlertDialogCancel>
          {seguintes > 0 && (
            <Button variant="destructive" size="lg" disabled={aCorrer} onClick={() => apagar(true)}>
              {aCorrer && escolha === "seguintes" && <LoaderCircleIcon className="animate-spin" />}
              Este e os seguintes ({seguintes + 1})
            </Button>
          )}
          <Button variant="destructive" size="lg" disabled={aCorrer} onClick={() => apagar(false)}>
            {aCorrer && escolha === "este" && <LoaderCircleIcon className="animate-spin" />}
            {seguintes > 0 ? "Só este" : "Apagar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
