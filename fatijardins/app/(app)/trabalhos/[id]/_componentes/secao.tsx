import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  id: string
  titulo: string
  icone: LucideIcon
  descricao?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** Cartão de uma secção da ficha do trabalho (título com ícone). */
export function Secao({ id, titulo, icone: Icone, descricao, className, children }: Props) {
  return (
    <section aria-labelledby={id} className={className}>
      <Card className="h-full">
        <CardHeader>
          <CardTitle id={id} className="flex items-center gap-2 text-lg">
            <Icone className="size-5 shrink-0 text-primary" aria-hidden="true" />
            {titulo}
          </CardTitle>
          {descricao && <CardDescription>{descricao}</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4">{children}</CardContent>
      </Card>
    </section>
  )
}
