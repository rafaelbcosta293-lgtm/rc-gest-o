import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  titulo: string
  descricao?: React.ReactNode
  /** Ligação para a página anterior (mostra uma seta de voltar). */
  voltar?: { href: string; texto?: string }
  /** Botões à direita (ex.: "Novo cliente"). */
  acoes?: React.ReactNode
}

export function CabecalhoPagina({ titulo, descricao, voltar, acoes }: Props) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6">
      {voltar && (
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
          <Link href={voltar.href}>
            <ArrowLeftIcon />
            {voltar.texto ?? "Voltar"}
          </Link>
        </Button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{titulo}</h1>
          {descricao && <div className="mt-1 text-sm text-muted-foreground">{descricao}</div>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
    </div>
  )
}
