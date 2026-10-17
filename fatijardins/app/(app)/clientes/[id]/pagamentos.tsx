import { Suspense } from "react"
import Link from "next/link"
import { BanknoteIcon, PlusIcon, ReceiptTextIcon, RepeatIcon, WalletIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import {
  descreverAtraso,
  ESTADOS_CONTRATO,
  NOMES_ESTADO_COBRANCA,
  NOMES_ESTADO_CONTRATO,
  NOMES_FREQUENCIA_CONTRATO,
  NOMES_METODO_PAGAMENTO,
  valorMensalComIva,
  VARIANTE_ESTADO_COBRANCA,
  VARIANTE_ESTADO_CONTRATO,
} from "@/lib/financas"
import { formatarData, formatarMoeda } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { CartaoHistorico, EsqueletoCartaoHistorico, Linha, SemRegistos } from "./historico"

/**
 * Pagamentos na ficha do cliente: SÓ o gerente (a página nem a mostra aos
 * outros perfis, para não fazer as consultas nem enviar valores).
 */

/** Quantos pagamentos se mostram. */
const LIMITE = 5

export function SeccaoPagamentos({ clienteId }: { clienteId: string }) {
  return (
    <section id="pagamentos" aria-labelledby="titulo-pagamentos" className="mt-8 scroll-mt-20">
      <h2 id="titulo-pagamentos" className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <WalletIcon className="size-5" aria-hidden="true" />
        Pagamentos
      </h2>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <Suspense fallback={<EsqueletoCartaoHistorico />}>
            <CobrancasCliente clienteId={clienteId} />
          </Suspense>
        </div>
        <div className="min-w-0">
          <Suspense fallback={<EsqueletoCartaoHistorico />}>
            <PagamentosCliente clienteId={clienteId} />
          </Suspense>
        </div>
        <div className="min-w-0">
          <Suspense fallback={<EsqueletoCartaoHistorico />}>
            <ContratosCliente clienteId={clienteId} />
          </Suspense>
        </div>
      </div>
    </section>
  )
}

function Total({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", alerta && "border-destructive/40 bg-destructive/5")}>
      <div className="text-sm text-muted-foreground">{rotulo}</div>
      <div className={cn("text-xl font-semibold tabular-nums", alerta && "text-destructive")}>
        {formatarMoeda(valor)}
      </div>
    </div>
  )
}

/** Soma ao cêntimo. */
function somar(valores: (number | null)[]): number {
  return valores.reduce<number>((total, valor) => total + Math.round((valor ?? 0) * 100), 0) / 100
}

// ---------------------------------------------------------------------
// Cobranças em aberto (com o total em dívida e em atraso)
// ---------------------------------------------------------------------

async function CobrancasCliente({ clienteId }: { clienteId: string }) {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cobrancas_com_saldo")
    .select("id, descricao, data_vencimento, em_divida, estado, dias_atraso, fatura_referencia")
    .eq("cliente_id", clienteId)
    .gt("em_divida", 0)
    .order("data_vencimento")
    .order("created_at")
  if (error) throw new Error(`Erro ao carregar as cobranças: ${error.message}`)

  const abertas = data.filter((cobranca) => cobranca.id)
  const emDivida = somar(abertas.map((cobranca) => cobranca.em_divida))
  const emAtraso = somar(abertas.filter((cobranca) => cobranca.estado === "atrasada").map((c) => c.em_divida))

  return (
    <CartaoHistorico
      id="titulo-cobrancas-cliente"
      titulo="Cobranças em aberto"
      icone={ReceiptTextIcon}
      acao={
        <Button asChild size="lg" variant="outline" className="w-full sm:w-fit">
          <Link href={`/financas/cobrancas/nova?cliente=${clienteId}`}>
            <PlusIcon />
            Nova cobrança
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Total rotulo="Em dívida" valor={emDivida} />
        <Total rotulo="Em atraso" valor={emAtraso} alerta={emAtraso > 0} />
      </div>
      {abertas.length === 0 ? (
        <SemRegistos>Não há cobranças por pagar.</SemRegistos>
      ) : (
        <ul className="-my-2.5 min-w-0 divide-y">
          {abertas.map((cobranca) => (
            <Linha
              key={cobranca.id}
              href={`/financas/cobrancas/${cobranca.id}`}
              titulo={cobranca.descricao}
              detalhes={
                <>
                  {cobranca.estado && (
                    <Badge variant={VARIANTE_ESTADO_COBRANCA[cobranca.estado]}>
                      {NOMES_ESTADO_COBRANCA[cobranca.estado]}
                    </Badge>
                  )}
                  <span className="tabular-nums">Vence {formatarData(cobranca.data_vencimento)}</span>
                  {cobranca.estado === "atrasada" && (cobranca.dias_atraso ?? 0) > 0 && (
                    <span className="font-medium text-destructive">{descreverAtraso(cobranca.dias_atraso ?? 0)}</span>
                  )}
                  {cobranca.fatura_referencia && <span>{cobranca.fatura_referencia}</span>}
                </>
              }
              fim={<span className="shrink-0 font-semibold tabular-nums">{formatarMoeda(cobranca.em_divida)}</span>}
            />
          ))}
        </ul>
      )}
    </CartaoHistorico>
  )
}

// ---------------------------------------------------------------------
// Últimos pagamentos
// ---------------------------------------------------------------------

async function PagamentosCliente({ clienteId }: { clienteId: string }) {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from("pagamentos")
    .select("id, data, valor, metodo, referencia, cobranca:cobrancas!inner(id, descricao, cliente_id)", {
      count: "exact",
    })
    .eq("cobranca.cliente_id", clienteId)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE)
  if (error) throw new Error(`Erro ao carregar os pagamentos: ${error.message}`)
  const total = count ?? data.length

  return (
    <CartaoHistorico
      id="titulo-pagamentos-cliente"
      titulo="Últimos pagamentos"
      icone={BanknoteIcon}
      descricao={total > LIMITE ? `Os ${LIMITE} mais recentes de ${total}.` : undefined}
    >
      {data.length === 0 ? (
        <SemRegistos>Ainda não há pagamentos deste cliente.</SemRegistos>
      ) : (
        <ul className="-my-2.5 min-w-0 divide-y">
          {data.map((pagamento) => (
            <Linha
              key={pagamento.id}
              href={`/financas/cobrancas/${pagamento.cobranca.id}`}
              titulo={
                <span className="tabular-nums">
                  {formatarData(pagamento.data)} · {NOMES_METODO_PAGAMENTO[pagamento.metodo]}
                </span>
              }
              detalhes={<span className="break-words">{pagamento.cobranca.descricao}</span>}
              fim={<span className="shrink-0 font-semibold tabular-nums">{formatarMoeda(pagamento.valor)}</span>}
            />
          ))}
        </ul>
      )}
    </CartaoHistorico>
  )
}

// ---------------------------------------------------------------------
// Contratos de manutenção (avenças)
// ---------------------------------------------------------------------

async function ContratosCliente({ clienteId }: { clienteId: string }) {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("contratos")
    .select("id, titulo, frequencia, valor_mensal, taxa_iva, estado, local:locais(nome)")
    .eq("cliente_id", clienteId)
    .order("titulo")
  if (error) throw new Error(`Erro ao carregar os contratos: ${error.message}`)
  // Ativos primeiro, depois suspensos e terminados.
  const contratos = data.toSorted(
    (a, b) => ESTADOS_CONTRATO.indexOf(a.estado) - ESTADOS_CONTRATO.indexOf(b.estado)
  )

  return (
    <CartaoHistorico
      id="titulo-contratos-cliente"
      titulo="Contratos de manutenção"
      icone={RepeatIcon}
      acao={
        <Button asChild size="lg" variant="outline" className="w-full sm:w-fit">
          <Link href={`/financas/contratos/novo?cliente=${clienteId}`}>
            <PlusIcon />
            Novo contrato
          </Link>
        </Button>
      }
    >
      {contratos.length === 0 ? (
        <SemRegistos>Este cliente não tem contratos.</SemRegistos>
      ) : (
        <ul className="-my-2.5 min-w-0 divide-y">
          {contratos.map((contrato) => (
            <Linha
              key={contrato.id}
              href={`/financas/contratos/${contrato.id}`}
              titulo={contrato.titulo}
              detalhes={
                <>
                  <Badge variant={VARIANTE_ESTADO_CONTRATO[contrato.estado]}>
                    {NOMES_ESTADO_CONTRATO[contrato.estado]}
                  </Badge>
                  {contrato.local && <span>{contrato.local.nome}</span>}
                  <span>{NOMES_FREQUENCIA_CONTRATO[contrato.frequencia]}</span>
                </>
              }
              fim={
                <span className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">
                    {formatarMoeda(valorMensalComIva(contrato.valor_mensal, contrato.taxa_iva))}
                  </span>
                  <span className="block text-xs text-muted-foreground">por mês, c/ IVA</span>
                </span>
              }
            />
          ))}
        </ul>
      )}
    </CartaoHistorico>
  )
}
