"use client"

import { CircleAlertIcon } from "lucide-react"

import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"

export default function Erro({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <EstadoVazio
      paginaInteira
      icone={CircleAlertIcon}
      titulo="Ocorreu um erro"
      descricao="Não foi possível carregar esta página. Verifique a ligação à internet e tente de novo."
      acao={<Button onClick={() => retry()}>Tentar de novo</Button>}
    />
  )
}
