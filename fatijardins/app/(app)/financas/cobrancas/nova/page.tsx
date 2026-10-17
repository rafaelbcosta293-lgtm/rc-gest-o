import { Suspense } from "react"
import Link from "next/link"
import { FileTextIcon, UsersIcon } from "lucide-react"

import { carregarOpcoesTrabalho } from "@/app/(app)/trabalhos/_componentes/dados-formulario"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { somarDiasData } from "@/lib/datas"
import { hojeEmLisboa } from "@/lib/formatar"
import { formatarNumeroOrcamento } from "@/lib/orcamentos"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { DIAS_VENCIMENTO, type CamposCobranca } from "@/lib/validacao/cobrancas"
import { valorParaCampo } from "../../_cobrancas/campos"
import { somar } from "../../_cobrancas/dados"
import { EsqueletoFormularioCobranca } from "../../_cobrancas/esqueletos"
import { FormularioCobranca, type OrcamentoCobranca } from "../../_cobrancas/formulario-cobranca"

export const metadata = { title: "Nova cobrança" }

type ParametrosPesquisa = PageProps<"/financas/cobrancas/nova">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

export default function PaginaNovaCobranca(props: PageProps<"/financas/cobrancas/nova">) {
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Nova cobrança" voltar={{ href: "/financas/cobrancas", texto: "Cobranças" }} />
      <Suspense fallback={<EsqueletoFormularioCobranca />}>
        <NovaCobranca searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}

async function NovaCobranca({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente")
  const pesquisa = await searchParams
  const orcamentoPedido = primeiroValor(pesquisa.orcamento)
  const clientePedido = primeiroValor(pesquisa.cliente)
  const supabase = await createClient()
  const hoje = hojeEmLisboa()

  const base = {
    data_emissao: hoje,
    data_vencimento: somarDiasData(hoje, DIAS_VENCIMENTO),
    fatura_referencia: "",
    fatura_data: "",
    notas: "",
  }

  // ?orcamento=<id>: cobrança de um orçamento aceite (cliente e local vêm dele).
  if (orcamentoPedido) {
    const orcamento = idObrigatorio.safeParse(orcamentoPedido).success
      ? await carregarOrcamento(supabase, orcamentoPedido)
      : null
    if (!orcamento || orcamento.estado !== "aceite") {
      return (
        <EstadoVazio
          icone={FileTextIcon}
          titulo="Só se cria uma cobrança de um orçamento aceite"
          descricao={
            orcamento
              ? "Este orçamento ainda não foi aceite pelo cliente."
              : "O orçamento não existe ou não tem acesso a ele."
          }
          acao={
            <Button asChild size="lg" variant="outline">
              <Link href={orcamento ? `/orcamentos/${orcamento.dados.id}` : "/orcamentos"}>
                {orcamento ? "Voltar ao orçamento" : "Orçamentos"}
              </Link>
            </Button>
          }
        />
      )
    }
    const { dados } = orcamento
    // Já há cobranças deste orçamento (ex.: a adjudicação): propõe-se o que falta.
    const falta = Math.round((dados.total - dados.jaCobrado) * 100) / 100
    const valoresIniciais: CamposCobranca = {
      ...base,
      cliente_id: orcamento.clienteId,
      local_id: "",
      orcamento_id: dados.id,
      descricao: `Orçamento ${dados.numero} — ${dados.titulo}`,
      valor: valorParaCampo(dados.jaCobrado > 0 && falta > 0 ? falta : dados.total),
    }
    return (
      <FormularioCobranca
        key={`orcamento|${dados.id}`}
        valoresIniciais={valoresIniciais}
        orcamento={dados}
        cancelarHref={`/orcamentos/${dados.id}`}
      />
    )
  }

  const opcoes = await carregarOpcoesTrabalho(supabase, sessao)
  if (opcoes.clientes.length === 0) {
    return (
      <EstadoVazio
        icone={UsersIcon}
        titulo="Ainda não há clientes"
        descricao="Registe primeiro o cliente a quem vai cobrar."
        acao={
          <Button asChild size="lg">
            <Link href="/clientes/novo">Novo cliente</Link>
          </Button>
        }
      />
    )
  }

  // ?cliente=<id>: o cliente fica escolhido.
  const clienteId = opcoes.clientes.some((cliente) => cliente.id === clientePedido) ? clientePedido : ""
  const valoresIniciais: CamposCobranca = {
    ...base,
    cliente_id: clienteId,
    local_id: "",
    orcamento_id: "",
    descricao: "",
    valor: "",
  }
  return (
    <FormularioCobranca
      key={`cliente|${clienteId}`}
      valoresIniciais={valoresIniciais}
      clientes={opcoes.clientes}
      locais={opcoes.locais}
      cancelarHref={clienteId ? `/clientes/${clienteId}` : "/financas/cobrancas"}
    />
  )
}

async function carregarOrcamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<{ estado: string; clienteId: string; dados: OrcamentoCobranca } | null> {
  const [orcamentoR, cobrancasR] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("id, ano, numero, titulo, estado, total, cliente_id, cliente:clientes(nome), local:locais(nome)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("cobrancas").select("valor").eq("orcamento_id", id),
  ])
  if (orcamentoR.error) throw new Error(`Erro ao carregar o orçamento: ${orcamentoR.error.message}`)
  if (cobrancasR.error) throw new Error(`Erro ao carregar as cobranças do orçamento: ${cobrancasR.error.message}`)
  const orcamento = orcamentoR.data
  if (!orcamento) return null
  return {
    estado: orcamento.estado,
    clienteId: orcamento.cliente_id,
    dados: {
      id: orcamento.id,
      numero: formatarNumeroOrcamento(orcamento.ano, orcamento.numero),
      titulo: orcamento.titulo,
      total: Number(orcamento.total),
      jaCobrado: somar(cobrancasR.data.map((cobranca) => Number(cobranca.valor))),
      cliente: orcamento.cliente?.nome ?? "—",
      local: orcamento.local?.nome ?? null,
    },
  }
}
