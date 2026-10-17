import { Suspense } from "react"
import Link from "next/link"
import { TriangleAlertIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Button } from "@/components/ui/button"
import { SeparadoresFinancas } from "./_componentes/separadores"
import { Dividas, EsqueletoDividas } from "./_dividas/dividas"

export const metadata = { title: "Dívidas" }

export default function PaginaDividas() {
  return (
    <>
      <SeparadoresFinancas />
      <CabecalhoPagina
        titulo="Dívidas"
        descricao="O que cada cliente ainda tem por pagar."
        acoes={
          <Button asChild variant="outline" size="lg">
            <Link href="/financas/cobrancas?filtro=atrasadas">
              <TriangleAlertIcon />
              Ver cobranças em atraso
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<EsqueletoDividas />}>
        <Dividas />
      </Suspense>
    </>
  )
}
