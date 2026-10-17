import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BanknoteIcon, CircleCheckIcon, InfoIcon, PencilIcon, ReceiptIcon } from "lucide-react"

import { BotaoApagar } from "@/app/(app)/clientes/botao-apagar"
import { Secao } from "@/app/(app)/trabalhos/[id]/_componentes/secao"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { formatarMes, NOMES_ORIGEM_COBRANCA } from "@/lib/financas"
import { formatarData, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { formatarNumeroOrcamento } from "@/lib/orcamentos"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { idObrigatorio } from "@/lib/validacao/comum"
import { apagarCobranca } from "../../_cobrancas/acoes"
import { BadgeEstadoCobranca } from "../../_cobrancas/badges"
import { COLUNAS_COBRANCA, paraCobranca } from "../../_cobrancas/dados"
import { EsqueletoCobranca } from "../../_cobrancas/esqueletos"
import type { PagamentoLista } from "../../_cobrancas/formulario-pagamento"
import { ListaPagamentos, RegistarPagamento } from "../../_cobrancas/pagamentos-cobranca"

export const metadata = { title: "Cobrança" }

type Props = PageProps<"/financas/cobrancas/[id]">

const LIGACAO = "font-medium text-primary underline-offset-4 hover:underline"

export default function PaginaCobranca(props: Props) {
  return (
    <Suspense fallback={<EsqueletoCobranca />}>
      <FichaCobranca params={props.params} />
    </Suspense>
  )
}

async function FichaCobranca({ params }: Pick<Props, "params">) {
  await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const [cobrancaR, pagamentosR] = await Promise.all([
    supabase
      .from("cobrancas_com_saldo")
      .select(
        `${COLUNAS_COBRANCA}, local:locais(nome), contrato:contratos(id, titulo),
         orcamento:orcamentos(id, ano, numero, titulo)`
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("pagamentos")
      .select("id, data, valor, metodo, referencia, notas, updated_at, autor:colaboradores(nome)")
      .eq("cobranca_id", id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false }),
  ])
  if (cobrancaR.error) throw new Error(`Não foi possível carregar a cobrança: ${cobrancaR.error.message}`)
  if (pagamentosR.error) throw new Error(`Não foi possível carregar os pagamentos: ${pagamentosR.error.message}`)
  if (!cobrancaR.data) notFound()
  const linha = cobrancaR.data
  const cobranca = paraCobranca(linha)

  const pagamentos: PagamentoLista[] = pagamentosR.data.map((pagamento) => ({
    id: pagamento.id,
    data: pagamento.data,
    valor: Number(pagamento.valor),
    metodo: pagamento.metodo,
    referencia: pagamento.referencia,
    notas: pagamento.notas,
    autor: pagamento.autor?.nome ?? null,
    updatedAt: pagamento.updated_at,
  }))
  const hoje = hojeEmLisboa()
  const paga = cobranca.estado === "paga"
  // Paga no dia do último pagamento.
  const pagaEm = paga && pagamentos.length > 0 ? pagamentos[0].data : null

  const origem =
    cobranca.origem === "contrato" && linha.contrato ? (
      <Link href={`/financas/contratos/${linha.contrato.id}`} className={LIGACAO}>
        Avença: {linha.contrato.titulo}
      </Link>
    ) : cobranca.origem === "orcamento" && linha.orcamento ? (
      <Link href={`/orcamentos/${linha.orcamento.id}`} className={LIGACAO}>
        Orçamento {formatarNumeroOrcamento(linha.orcamento.ano, linha.orcamento.numero)} — {linha.orcamento.titulo}
      </Link>
    ) : (
      NOMES_ORIGEM_COBRANCA[cobranca.origem]
    )

  return (
    <>
      <CabecalhoPagina
        titulo={cobranca.descricao}
        voltar={{ href: "/financas/cobrancas", texto: "Cobranças" }}
        descricao={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <BadgeEstadoCobranca estado={cobranca.estado} diasAtraso={cobranca.diasAtraso} />
            <Link href={`/clientes/${cobranca.clienteId}`} className={LIGACAO}>
              {cobranca.cliente}
            </Link>
          </span>
        }
        acoes={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href={`/financas/cobrancas/${cobranca.id}/editar`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
            {pagamentos.length === 0 && (
              <BotaoApagar
                acao={apagarCobranca.bind(null, cobranca.id)}
                titulo="Apagar esta cobrança?"
                descricao={
                  <>
                    Vai apagar a cobrança <strong>{cobranca.descricao}</strong> ({formatarMoeda(cobranca.valor)}) de{" "}
                    {cobranca.cliente}. Esta ação não pode ser desfeita.
                  </>
                }
              />
            )}
          </>
        }
      />

      <div className="grid gap-4">
        <Secao id="titulo-valores" titulo="Valores" icone={ReceiptIcon}>
          <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">Em dívida</dt>
              <dd
                className={cn(
                  "text-4xl font-semibold tracking-tight tabular-nums",
                  cobranca.estado === "atrasada" && "text-destructive",
                  paga && "text-muted-foreground"
                )}
              >
                {formatarMoeda(cobranca.emDivida)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Valor (com IVA)</dt>
              <dd className="text-lg font-medium tabular-nums">{formatarMoeda(cobranca.valor)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Pago</dt>
              <dd className="text-lg font-medium tabular-nums">{formatarMoeda(cobranca.pago)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Vencimento</dt>
              <dd className={cn("text-lg font-medium tabular-nums", cobranca.estado === "atrasada" && "text-destructive")}>
                {formatarData(cobranca.dataVencimento)}
              </dd>
            </div>
          </dl>
          {paga ? (
            <p className="flex items-center gap-2 rounded-lg bg-accent/60 p-3 text-sm font-medium text-accent-foreground">
              <CircleCheckIcon className="size-4 shrink-0" aria-hidden="true" />
              {pagaEm ? `Paga em ${formatarData(pagaEm)}.` : "Paga."}
            </p>
          ) : (
            <RegistarPagamento key={cobranca.updatedAt + cobranca.pago} cobrancaId={cobranca.id} hoje={hoje} emDivida={cobranca.emDivida} />
          )}
        </Secao>

        <Secao
          id="titulo-pagamentos"
          titulo="Pagamentos"
          icone={BanknoteIcon}
          descricao="Dos mais recentes para os mais antigos."
        >
          <ListaPagamentos cobrancaId={cobranca.id} hoje={hoje} pagamentos={pagamentos} />
        </Secao>

        <Secao id="titulo-dados" titulo="Dados" icone={InfoIcon}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Dado rotulo="Cliente">
              <Link href={`/clientes/${cobranca.clienteId}`} className={LIGACAO}>
                {cobranca.cliente}
              </Link>
            </Dado>
            <Dado rotulo="Local">{linha.local?.nome ?? "—"}</Dado>
            <Dado rotulo="Origem">{origem}</Dado>
            {cobranca.periodo && <Dado rotulo="Mês da avença">{formatarMes(cobranca.periodo)}</Dado>}
            <Dado rotulo="Fatura">
              {cobranca.faturaReferencia ? (
                <>
                  {cobranca.faturaReferencia}
                  {cobranca.faturaData && (
                    <span className="block font-normal text-muted-foreground">
                      de {formatarData(cobranca.faturaData)}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-normal text-muted-foreground">Sem fatura</span>
              )}
            </Dado>
            <Dado rotulo="Data de emissão">{formatarData(cobranca.dataEmissao)}</Dado>
            <Dado rotulo="Vencimento">{formatarData(cobranca.dataVencimento)}</Dado>
          </dl>
          <p className="text-xs text-muted-foreground">
            A fatura é emitida no programa de faturação certificado; aqui guarda-se só a referência.
          </p>
          <div className="text-sm">
            <p className="text-muted-foreground">Notas</p>
            {cobranca.notas ? (
              <p className="mt-0.5 break-words whitespace-pre-line">{cobranca.notas}</p>
            ) : (
              <p className="mt-0.5 text-muted-foreground">—</p>
            )}
          </div>
        </Secao>
      </div>
    </>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 font-medium break-words">{children}</dd>
    </div>
  )
}
