"use client"

import { CircleAlertIcon } from "lucide-react"

import { EstadoVazio } from "@/components/estado-vazio"
import { Logotipo } from "@/components/logotipo"
import { Button } from "@/components/ui/button"

/** Erros fora das páginas (ex.: no menu ao ler a sessão). Fica sem o menu da app. */
export default function ErroGeral({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4">
      <Logotipo />
      <EstadoVazio
        icone={CircleAlertIcon}
        paginaInteira
        titulo="Ocorreu um erro"
        descricao="Não foi possível carregar a app. Verifique a ligação à internet e tente de novo."
        acao={<Button onClick={() => retry()}>Tentar de novo</Button>}
      />
    </div>
  )
}
