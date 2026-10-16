"use client"

import { useTransition } from "react"
import { ArchiveIcon, ArchiveRestoreIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { alterarEstadoConsumivel } from "./acoes"

/** Desativar / reativar um consumível (a página é atualizada pelo revalidatePath da ação). */
export function BotaoEstadoConsumivel({ id, ativo }: { id: string; ativo: boolean }) {
  const [aGuardar, iniciar] = useTransition()

  function alternar() {
    iniciar(async () => {
      try {
        const resultado = await alterarEstadoConsumivel(id, !ativo)
        if (resultado.ok) toast.success(resultado.mensagem)
        else toast.error(resultado.erro)
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
      }
    })
  }

  const Icone = aGuardar ? LoaderCircleIcon : ativo ? ArchiveIcon : ArchiveRestoreIcon

  return (
    <Button variant="outline" size="lg" onClick={alternar} disabled={aGuardar}>
      <Icone className={aGuardar ? "animate-spin" : undefined} />
      {ativo ? "Desativar" : "Reativar"}
    </Button>
  )
}
