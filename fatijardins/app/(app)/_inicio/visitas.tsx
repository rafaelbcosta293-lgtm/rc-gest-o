import Link from "next/link"
import { CalendarCheckIcon, ChevronRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { hojeEmLisboa, somarDias } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { formatarQuandoVisita, nomeSitioVisita } from "@/lib/visitas"

/** Visitas para orçamento de hoje e dos próximos 7 dias (gerente e chefes de equipa). */
export async function ProximasVisitas() {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const { data, count, error } = await supabase
    .from("visitas")
    .select(
      "id, data, hora, cliente:clientes(nome), local:locais(nome), responsavel:colaboradores!visitas_responsavel_id_fkey(nome)",
      { count: "exact" }
    )
    .gte("data", hoje)
    .lte("data", somarDias(hoje, 7))
    .order("data")
    .order("hora", { nullsFirst: false })
    .limit(8)
  if (error) throw new Error(`Não foi possível carregar as próximas visitas: ${error.message}`)
  const total = count ?? data.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Próximas visitas</h2>
        </CardTitle>
        <CardDescription>
          {total === 0
            ? "Nenhuma nos próximos 7 dias."
            : `${total === 1 ? "1 visita" : `${total} visitas`} nos próximos 7 dias`}
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="h-10">
            <Link href="/orcamentos/visitas">
              Visitas
              <ChevronRightIcon />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      {data.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {data.map((visita) => (
              <li key={visita.id}>
                <Link href={`/orcamentos/visitas/${visita.id}`} className="flex min-h-12 items-center gap-3 py-2.5">
                  <CalendarCheckIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium break-words">
                      {nomeSitioVisita(visita.cliente?.nome, visita.local?.nome)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      <span className="tabular-nums">{formatarQuandoVisita(visita.data, visita.hora)}</span>
                      {visita.responsavel && ` · ${visita.responsavel.nome}`}
                    </span>
                  </span>
                  {visita.data === hoje && <Badge className="shrink-0">Hoje</Badge>}
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}
