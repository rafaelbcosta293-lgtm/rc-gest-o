import type { LucideIcon } from "lucide-react"

type Props = {
  icone: LucideIcon
  titulo: string
  descricao?: string
  acao?: React.ReactNode
  /** Quando o estado ocupa a página inteira (sem permissão, não encontrada, erro): o título é o <h1>. */
  paginaInteira?: boolean
}

export function EstadoVazio({ icone: Icone, titulo, descricao, acao, paginaInteira }: Props) {
  const Titulo = paginaInteira ? "h1" : "p"
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icone className="size-6" />
      </div>
      <Titulo className="font-medium">{titulo}</Titulo>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
