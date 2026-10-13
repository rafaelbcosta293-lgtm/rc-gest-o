"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
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
import { cn } from "@/lib/utils"

type Props = {
  /** Server Action já ligada ao registo (ex.: apagarCliente.bind(null, id)). */
  acao: () => Promise<ResultadoAcao>
  titulo: string
  descricao: React.ReactNode
  className?: string
}

/** Botão "Apagar" com pedido de confirmação. Mostra o erro traduzido se não for possível apagar. */
export function BotaoApagar({ acao, titulo, descricao, className }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [aApagar, iniciar] = useTransition()

  function confirmar(evento: React.MouseEvent) {
    // Manter a janela aberta enquanto apaga.
    evento.preventDefault()
    iniciar(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await acao()
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      setAberto(false)
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success(resultado.mensagem ?? "Apagado.")
      if (resultado.redirecionar) router.push(resultado.redirecionar)
    })
  }

  return (
    <AlertDialog open={aberto} onOpenChange={(abrir) => !aApagar && setAberto(abrir)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className={cn("text-destructive hover:text-destructive", className)}>
          <Trash2Icon />
          Apagar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={aApagar} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmar}
            disabled={aApagar}
            className={buttonVariants({ variant: "destructive", size: "lg" })}
          >
            {aApagar && <LoaderCircleIcon className="animate-spin" />}
            Apagar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
