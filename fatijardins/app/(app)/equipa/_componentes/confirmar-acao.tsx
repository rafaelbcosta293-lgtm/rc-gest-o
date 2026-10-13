"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { Button } from "@/components/ui/button"
import type { ResultadoAcao } from "@/lib/acoes"

type Props = {
  /** Botão que abre a confirmação. */
  gatilho: React.ReactNode
  titulo: string
  descricao: React.ReactNode
  confirmar: string
  acao: () => Promise<ResultadoAcao>
}

/**
 * Pede confirmação (AlertDialog) antes de uma ação destrutiva e corre a
 * Server Action. Fica aberto enquanto a ação decorre e mostra o resultado.
 */
export function ConfirmarAcao({ gatilho, titulo, descricao, confirmar, acao }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [aCorrer, iniciar] = useTransition()

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
        return
      }
      toast.success(resultado.mensagem ?? "Concluído.")
      setAberto(false)
      if (resultado.redirecionar) router.push(resultado.redirecionar)
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
          <AlertDialogCancel disabled={aCorrer} className="h-11">
            Cancelar
          </AlertDialogCancel>
          <Button variant="destructive" onClick={executar} disabled={aCorrer} className="h-11">
            {aCorrer && <LoaderCircleIcon className="animate-spin" />}
            {confirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
