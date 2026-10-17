"use client"

import { useTransition } from "react"
import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { gerarContratosAgora } from "./acoes"

/**
 * Corre já a geração que a BD faz todos os dias de manhã: visitas das
 * próximas semanas e cobranças do mês (a página atualiza-se pela ação).
 */
export function BotaoGerarContratos() {
  const [aGerar, iniciar] = useTransition()

  function gerar() {
    iniciar(async () => {
      try {
        const resultado = await gerarContratosAgora()
        if (resultado.ok) toast.success(resultado.mensagem)
        else toast.error(resultado.erro)
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
      }
    })
  }

  return (
    <Button variant="outline" size="lg" onClick={gerar} disabled={aGerar}>
      {aGerar ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
      Gerar agora
    </Button>
  )
}
