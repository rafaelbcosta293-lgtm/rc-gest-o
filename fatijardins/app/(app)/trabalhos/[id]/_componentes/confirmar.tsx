"use client"

import { useLayoutEffect, useState, useTransition } from "react"
import { LoaderCircleIcon } from "lucide-react"
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
import { Button, buttonVariants } from "@/components/ui/button"
import type { ResultadoAcao } from "@/lib/acoes"

type Props = {
  /** Botão que abre a confirmação. */
  gatilho: React.ReactNode
  titulo: string
  descricao: React.ReactNode
  /** Texto do botão de confirmar. */
  confirmar: string
  variante?: "default" | "destructive"
  acao: () => Promise<ResultadoAcao>
  aoConcluir?: () => void
}

/**
 * Pede confirmação antes de uma ação e corre a Server Action. A janela fica
 * aberta enquanto a ação decorre; o resultado aparece numa notificação.
 */
export function Confirmar({ gatilho, titulo, descricao, confirmar, variante = "destructive", acao, aoConcluir }: Props) {
  const [aberto, setAberto] = useState(false)
  const [aCorrer, iniciar] = useTransition()

  // Ao sair da página (que fica guardada escondida), fechar a janela.
  useLayoutEffect(() => () => setAberto(false), [])

  function executar() {
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
        setAberto(false)
        return
      }
      toast.success(resultado.mensagem ?? "Concluído.")
      setAberto(false)
      aoConcluir?.()
    })
  }

  return (
    <AlertDialog open={aberto} onOpenChange={(abrir) => !aCorrer && setAberto(abrir)}>
      <AlertDialogTrigger asChild>{gatilho}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={aCorrer} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Voltar
          </AlertDialogCancel>
          <Button variant={variante} size="lg" onClick={executar} disabled={aCorrer}>
            {aCorrer && <LoaderCircleIcon className="animate-spin" />}
            {confirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
