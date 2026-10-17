import Link from "next/link"
import { ChevronRightIcon, ReceiptTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { descreverAtraso } from "@/lib/financas"
import { formatarMoeda } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"

/** Quantas cobranças se mostram (o resto fica no "Ver todas"). */
const MAXIMO = 5

/**
 * Cobranças vencidas e por pagar, das mais antigas para as mais recentes.
 * Só o gerente (a RLS só lhe mostra a ele). Sem atrasos, não aparece.
 */
export async function CobrancasAtraso() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cobrancas_com_saldo")
    .select("id, descricao, em_divida, dias_atraso, cliente:clientes(nome)")
    .eq("estado", "atrasada")
    .order("data_vencimento")
    .order("created_at")
  if (error) throw new Error(`Não foi possível carregar as cobranças em atraso: ${error.message}`)
  const lista = data.filter((cobranca) => cobranca.id)
  if (lista.length === 0) return null

  const total = lista.reduce((soma, cobranca) => soma + Math.round((cobranca.em_divida ?? 0) * 100), 0) / 100
  const mais = lista.length - MAXIMO

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Cobranças em atraso</h2>
        </CardTitle>
        <CardDescription>
          <span className="font-semibold text-destructive tabular-nums">{formatarMoeda(total)}</span> em atraso
          {" · "}
          {lista.length === 1 ? "1 cobrança" : `${lista.length} cobranças`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {lista.slice(0, MAXIMO).map((cobranca) => (
            <li key={cobranca.id}>
              <Link href={`/financas/cobrancas/${cobranca.id}`} className="flex min-h-12 items-center gap-3 py-2.5">
                <ReceiptTextIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">{cobranca.cliente?.nome}</span>
                  <span className="block text-sm break-words text-muted-foreground">{cobranca.descricao}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">{formatarMoeda(cobranca.em_divida)}</span>
                  <span className="block text-xs font-medium whitespace-nowrap text-destructive">
                    {descreverAtraso(cobranca.dias_atraso ?? 0)}
                  </span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="mt-auto justify-between gap-3 border-t pt-4 [.border-t]:pt-4">
        <span className="text-sm text-muted-foreground">{mais > 0 && `e mais ${mais}`}</span>
        <Button asChild variant="ghost" size="sm" className="-mr-2 h-10">
          <Link href="/financas/cobrancas?filtro=atrasadas">
            Ver todas
            <ChevronRightIcon />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
