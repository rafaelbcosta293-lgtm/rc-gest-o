"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { eDataValida } from "@/lib/datas"
import { eUuid, urlNovoTrabalho } from "./tipos"

/** "Novo trabalho" já com a data e a equipa que a agenda está a mostrar. Dentro de <Suspense>. */
export function BotaoNovoTrabalho() {
  const searchParams = useSearchParams()
  const data = searchParams.get("data")
  const equipa = searchParams.get("equipa")

  return (
    <Button asChild size="lg">
      <Link href={urlNovoTrabalho(eDataValida(data) ? data : null, eUuid(equipa) ? equipa : null)}>
        <PlusIcon />
        Novo trabalho
      </Link>
    </Button>
  )
}

export function BotaoNovoTrabalhoEsqueleto() {
  return (
    <Button size="lg" disabled>
      <PlusIcon />
      Novo trabalho
    </Button>
  )
}
