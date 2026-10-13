import Link from "next/link"
import { CalendarOffIcon, ChevronRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatarData, hojeEmLisboa, somarDias } from "@/lib/formatar"
import { NOMES_TIPO_AUSENCIA } from "@/lib/rotulos"
import { createClient } from "@/lib/supabase/server"

/** Ausências dos próximos 30 dias (a RLS filtra: gerente todas, chefe a equipa, colaborador as suas). */
export async function ProximasAusencias() {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const { data: ausencias } = await supabase
    .from("ausencias")
    .select("id, tipo, data_inicio, data_fim, colaborador:colaboradores(id, nome)")
    .lte("data_inicio", somarDias(hoje, 30))
    .gte("data_fim", hoje)
    .order("data_inicio")
    .limit(10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Ausências nos próximos 30 dias</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!ausencias || ausencias.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarOffIcon className="size-4" />
            Não há ausências marcadas.
          </p>
        ) : (
          <ul className="divide-y">
            {ausencias.map((ausencia) => (
              <li key={ausencia.id}>
                <Link
                  href={`/equipa/colaboradores/${ausencia.colaborador?.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{ausencia.colaborador?.nome}</span>
                    <span className="block text-sm text-muted-foreground">
                      {ausencia.data_inicio === ausencia.data_fim
                        ? formatarData(ausencia.data_inicio)
                        : `${formatarData(ausencia.data_inicio)} a ${formatarData(ausencia.data_fim)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={ausencia.data_inicio <= hoje ? "default" : "secondary"}>
                      {NOMES_TIPO_AUSENCIA[ausencia.tipo]}
                    </Badge>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
