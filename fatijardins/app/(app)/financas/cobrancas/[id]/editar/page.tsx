import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { formatarMes, NOMES_ORIGEM_COBRANCA } from "@/lib/financas"
import { formatarMoeda } from "@/lib/formatar"
import { formatarNumeroOrcamento } from "@/lib/orcamentos"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { valorParaCampo } from "../../../_cobrancas/campos"
import { COLUNAS_COBRANCA, paraCobranca } from "../../../_cobrancas/dados"
import { EsqueletoPaginaFormularioCobranca } from "../../../_cobrancas/esqueletos"
import { FormularioCobranca } from "../../../_cobrancas/formulario-cobranca"

export const metadata = { title: "Editar cobrança" }

type Props = PageProps<"/financas/cobrancas/[id]/editar">

const LIGACAO = "font-medium text-primary underline-offset-4 hover:underline"

export default function PaginaEditarCobranca(props: Props) {
  return (
    <Suspense fallback={<EsqueletoPaginaFormularioCobranca />}>
      <EditarCobranca params={props.params} />
    </Suspense>
  )
}

async function EditarCobranca({ params }: Pick<Props, "params">) {
  await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: linha, error } = await supabase
    .from("cobrancas_com_saldo")
    .select(
      `${COLUNAS_COBRANCA}, local:locais(nome), contrato:contratos(id, titulo),
       orcamento:orcamentos(id, ano, numero, titulo)`
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Não foi possível carregar a cobrança: ${error.message}`)
  if (!linha) notFound()
  const cobranca = paraCobranca(linha)

  // O que já não se altera: cliente, local e origem (contrato e mês, ou orçamento).
  const resumo = (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <Dado rotulo="Cliente">{cobranca.cliente}</Dado>
      <Dado rotulo="Local">{linha.local?.nome ?? "—"}</Dado>
      <Dado rotulo="Origem">
        {linha.contrato ? (
          <Link href={`/financas/contratos/${linha.contrato.id}`} className={LIGACAO}>
            Avença: {linha.contrato.titulo}
          </Link>
        ) : linha.orcamento ? (
          <Link href={`/orcamentos/${linha.orcamento.id}`} className={LIGACAO}>
            Orçamento {formatarNumeroOrcamento(linha.orcamento.ano, linha.orcamento.numero)} — {linha.orcamento.titulo}
          </Link>
        ) : (
          NOMES_ORIGEM_COBRANCA[cobranca.origem]
        )}
      </Dado>
      {cobranca.periodo && <Dado rotulo="Mês da avença">{formatarMes(cobranca.periodo)}</Dado>}
      {cobranca.pago > 0 && <Dado rotulo="Já pago">{formatarMoeda(cobranca.pago)}</Dado>}
    </dl>
  )

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        titulo="Editar cobrança"
        descricao={cobranca.descricao}
        voltar={{ href: `/financas/cobrancas/${cobranca.id}`, texto: "Cobrança" }}
      />
      {/* A chave volta a montar o formulário se a cobrança mudar entretanto. */}
      <FormularioCobranca
        key={cobranca.updatedAt}
        valoresIniciais={{
          cliente_id: cobranca.clienteId,
          local_id: cobranca.localId ?? "",
          orcamento_id: cobranca.orcamentoId ?? "",
          descricao: cobranca.descricao,
          valor: valorParaCampo(cobranca.valor),
          data_emissao: cobranca.dataEmissao,
          data_vencimento: cobranca.dataVencimento,
          fatura_referencia: cobranca.faturaReferencia ?? "",
          fatura_data: cobranca.faturaData ?? "",
          notas: cobranca.notas ?? "",
        }}
        edicao={{ cobrancaId: cobranca.id, resumo }}
        cancelarHref={`/financas/cobrancas/${cobranca.id}`}
      />
    </div>
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
