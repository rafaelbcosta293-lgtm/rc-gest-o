import Link from "next/link"
import { ChevronRightIcon, CircleCheckIcon } from "lucide-react"

import { EstadoVazio } from "@/components/estado-vazio"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import { valorMensalComIva } from "@/lib/financas"
import { formatarData, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

/** Soma valores em euros sem erros de arredondamento (ao cêntimo). */
function somar(valores: (number | null)[]): number {
  return valores.reduce<number>((total, valor) => total + Math.round((valor ?? 0) * 100), 0) / 100
}

/** 1.º dia do mês de uma data aaaa-mm-dd e o 1.º dia do mês seguinte. */
function limitesMes(hoje: string): [string, string] {
  const [ano, mes] = hoje.split("-").map(Number)
  const seguinte = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`
  return [`${hoje.slice(0, 7)}-01`, seguinte]
}

function plural(n: number, um: string, varios: string) {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`
}

function Indicador({
  href,
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  href: string
  rotulo: string
  valor: number
  detalhe: string
  alerta?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50 sm:p-4",
        alerta && "border-destructive/40 bg-destructive/5"
      )}
    >
      <span className="text-sm leading-tight text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "mt-1 block text-xl leading-tight font-semibold tabular-nums sm:text-2xl",
          alerta && "text-destructive"
        )}
      >
        {formatarMoeda(valor)}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">{detalhe}</span>
    </Link>
  )
}

/** Resumo (cartões) e lista dos clientes com dívida. Só o gerente. */
export async function Dividas() {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const [inicioMes, inicioMesSeguinte] = limitesMes(hojeEmLisboa())
  const [dividasR, pagamentosR, contratosR] = await Promise.all([
    supabase
      .from("dividas_clientes")
      .select("cliente_id, nome, em_divida, em_atraso, cobrancas_abertas, cobrancas_atrasadas, vencida_desde")
      .order("em_atraso", { ascending: false })
      .order("em_divida", { ascending: false })
      .order("nome"),
    supabase.from("pagamentos").select("valor").gte("data", inicioMes).lt("data", inicioMesSeguinte),
    supabase.from("contratos").select("valor_mensal, taxa_iva").eq("estado", "ativo"),
  ])
  if (dividasR.error) throw new Error(`Erro ao carregar as dívidas: ${dividasR.error.message}`)
  if (pagamentosR.error) throw new Error(`Erro ao carregar os pagamentos: ${pagamentosR.error.message}`)
  if (contratosR.error) throw new Error(`Erro ao carregar os contratos: ${contratosR.error.message}`)

  const dividas = dividasR.data.filter((divida) => divida.cliente_id)
  const emDivida = somar(dividas.map((divida) => divida.em_divida))
  const emAtraso = somar(dividas.map((divida) => divida.em_atraso))
  const atrasadas = dividas.reduce((total, divida) => total + (divida.cobrancas_atrasadas ?? 0), 0)
  const clientesAtraso = dividas.filter((divida) => (divida.cobrancas_atrasadas ?? 0) > 0).length
  const recebido = somar(pagamentosR.data.map((pagamento) => pagamento.valor))
  const avencas = somar(
    contratosR.data.map((contrato) => valorMensalComIva(contrato.valor_mensal, contrato.taxa_iva))
  )

  return (
    <>
      <section
        aria-label="Resumo"
        className="mb-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4"
      >
        <Indicador
          href="/financas/cobrancas"
          rotulo="Total em dívida"
          valor={emDivida}
          detalhe={plural(dividas.length, "cliente", "clientes")}
        />
        <Indicador
          href="/financas/cobrancas?filtro=atrasadas"
          rotulo="Total em atraso"
          valor={emAtraso}
          detalhe={atrasadas === 0 ? "Nada em atraso" : plural(atrasadas, "cobrança", "cobranças")}
          alerta={emAtraso > 0}
        />
        <Indicador
          href="/financas/pagamentos"
          rotulo="Recebido este mês"
          valor={recebido}
          detalhe={plural(pagamentosR.data.length, "pagamento", "pagamentos")}
        />
        <Indicador
          href="/financas/contratos"
          rotulo="Avenças ativas por mês"
          valor={avencas}
          detalhe={`${plural(contratosR.data.length, "contrato", "contratos")} · com IVA`}
        />
      </section>

      <section aria-labelledby="titulo-dividas-clientes">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="titulo-dividas-clientes" className="text-lg font-semibold">
            Por cliente
          </h2>
          {dividas.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {plural(dividas.length, "cliente", "clientes")}
              {clientesAtraso > 0 && ` · ${clientesAtraso} com atrasos`}
            </p>
          )}
        </div>
        {dividas.length === 0 ? (
          <EstadoVazio
            icone={CircleCheckIcon}
            titulo="Nenhum cliente com dívida."
            descricao="Todas as cobranças registadas estão pagas."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {dividas.map((divida) => {
              const abertas = divida.cobrancas_abertas ?? 0
              const atrasadasCliente = divida.cobrancas_atrasadas ?? 0
              const atraso = divida.em_atraso ?? 0
              return (
                <li key={divida.cliente_id}>
                  <Link
                    href={`/clientes/${divida.cliente_id}#pagamentos`}
                    className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium break-words">{divida.nome}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                        <span>{plural(abertas, "cobrança em aberto", "cobranças em aberto")}</span>
                        {atrasadasCliente > 0 && (
                          <span className="font-medium text-destructive">
                            {atrasadasCliente === abertas && abertas > 1
                              ? "todas em atraso"
                              : `${atrasadasCliente} em atraso`}
                          </span>
                        )}
                        {divida.vencida_desde && (
                          <span className="whitespace-nowrap tabular-nums">
                            vencida desde {formatarData(divida.vencida_desde)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{formatarMoeda(divida.em_divida)}</span>
                      {atraso > 0 && (
                        <span className="block text-xs font-medium text-destructive tabular-nums">
                          {formatarMoeda(atraso)} em atraso
                        </span>
                      )}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

export function EsqueletoDividas() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <div className="mb-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="mb-3 h-6 w-32" />
      <div className="grid gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}
