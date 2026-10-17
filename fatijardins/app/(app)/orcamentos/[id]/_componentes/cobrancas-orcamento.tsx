import Link from "next/link"
import { ChevronRightIcon, PlusIcon, ReceiptIcon } from "lucide-react"

import { BadgeEstadoCobranca } from "@/app/(app)/financas/_cobrancas/badges"
import { COLUNAS_COBRANCA, paraCobranca, somar } from "@/app/(app)/financas/_cobrancas/dados"
import { Secao } from "@/app/(app)/trabalhos/[id]/_componentes/secao"
import { Button } from "@/components/ui/button"
import { formatarData, formatarMoeda } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"

type Props = {
  orcamentoId: string
  aceite: boolean
  total: number
}

/**
 * Cobranças ligadas ao orçamento (só o gerente vê dinheiro). Num orçamento
 * aceite, o botão "Criar cobrança" (ex.: a adjudicação e o resto no fim).
 */
export async function CobrancasOrcamento({ orcamentoId, aceite, total }: Props) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cobrancas_com_saldo")
    .select(COLUNAS_COBRANCA)
    .eq("orcamento_id", orcamentoId)
    .order("data_emissao")
    .order("created_at")
  if (error) throw new Error(`Não foi possível carregar as cobranças do orçamento: ${error.message}`)
  const cobrancas = data.map(paraCobranca)
  if (!aceite && cobrancas.length === 0) return null

  const cobrado = somar(cobrancas.map((cobranca) => cobranca.valor))
  const emDivida = somar(cobrancas.map((cobranca) => cobranca.emDivida))

  return (
    <Secao
      id="titulo-cobrancas"
      titulo="Cobranças"
      icone={ReceiptIcon}
      descricao={
        cobrancas.length === 0
          ? "Ainda não há cobranças deste orçamento."
          : `Já pedido ao cliente: ${formatarMoeda(cobrado)} de ${formatarMoeda(total)}${emDivida > 0 ? ` · em dívida ${formatarMoeda(emDivida)}` : ""}.`
      }
    >
      {cobrancas.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {cobrancas.map((cobranca) => (
            <li key={cobranca.id}>
              <Link
                href={`/financas/cobrancas/${cobranca.id}`}
                className="flex min-h-16 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50 active:bg-accent"
              >
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium break-words">{cobranca.descricao}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                    <BadgeEstadoCobranca estado={cobranca.estado} diasAtraso={cobranca.diasAtraso} />
                    <span className="tabular-nums">Vence {formatarData(cobranca.dataVencimento)}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">{formatarMoeda(cobranca.valor)}</span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {aceite && (
        <Button asChild size="lg" variant={cobrancas.length ? "outline" : "default"} className="w-full sm:w-fit">
          <Link href={`/financas/cobrancas/nova?orcamento=${orcamentoId}`}>
            <PlusIcon />
            Criar cobrança
          </Link>
        </Button>
      )}
    </Secao>
  )
}
