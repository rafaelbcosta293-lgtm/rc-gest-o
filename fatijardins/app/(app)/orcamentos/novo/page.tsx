import { Suspense } from "react"
import Link from "next/link"
import { TreesIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { somarDiasData } from "@/lib/datas"
import { hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import type { CamposOrcamento } from "@/lib/validacao/orcamentos"
import { carregarOpcoesOrcamento, visitaOrigem } from "../_componentes/dados"
import { EsqueletoFormularioOrcamento } from "../_componentes/esqueletos"
import { FormularioOrcamento } from "../_componentes/formulario-orcamento"

export const metadata = { title: "Novo orçamento" }

type ParametrosPesquisa = PageProps<"/orcamentos/novo">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

export default function PaginaNovoOrcamento(props: PageProps<"/orcamentos/novo">) {
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Novo orçamento" voltar={{ href: "/orcamentos", texto: "Orçamentos" }} />
      <Suspense fallback={<EsqueletoFormularioOrcamento />}>
        <NovoOrcamento searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}

async function NovoOrcamento({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const pesquisa = await searchParams
  const visitaPedida = primeiroValor(pesquisa.visita)
  const clientePedido = primeiroValor(pesquisa.cliente)
  const supabase = await createClient()

  // ?visita=<id>: o cliente e o local vêm da visita (e o orçamento fica ligado a ela).
  let visita = null
  if (idObrigatorio.safeParse(visitaPedida).success) {
    const { data, error } = await supabase
      .from("visitas")
      .select("id, data, local_id, cliente_id, medidas, area_m2, notas")
      .eq("id", visitaPedida)
      .maybeSingle()
    if (error) throw new Error(`Erro ao carregar a visita: ${error.message}`)
    visita = data
  }

  const opcoes = await carregarOpcoesOrcamento(
    supabase,
    sessao,
    visita ? { clienteId: visita.cliente_id, localId: visita.local_id } : undefined
  )
  if (opcoes.locais.length === 0) {
    return (
      <EstadoVazio
        icone={TreesIcon}
        titulo="Ainda não há clientes com locais"
        descricao="Para fazer um orçamento, registe primeiro o cliente e o local (jardim) onde se vai trabalhar."
        acao={
          <Button asChild size="lg">
            <Link href="/clientes/novo">Novo cliente</Link>
          </Button>
        }
      />
    )
  }

  // ?cliente=<id>: o cliente fica escolhido (e o local, se só tiver um).
  const clienteId = visita?.cliente_id ?? (opcoes.clientes.some((c) => c.id === clientePedido) ? clientePedido : "")
  const locaisDoCliente = opcoes.locais.filter((local) => local.clienteId === clienteId && local.ativo)
  const localId = visita?.local_id ?? (locaisDoCliente.length === 1 ? locaisDoCliente[0].id : "")
  const hoje = hojeEmLisboa()

  const valoresIniciais: CamposOrcamento = {
    cliente_id: clienteId,
    local_id: localId,
    visita_id: visita?.id ?? "",
    titulo: "",
    descricao: "",
    data: hoje,
    validade: somarDiasData(hoje, opcoes.validadeDias),
    condicoes: opcoes.condicoes,
    notas_internas: "",
  }

  return (
    <FormularioOrcamento
      // Outro pré-preenchimento (outra visita ou cliente) = formulário novo.
      key={`${visita?.id ?? ""}|${clienteId}`}
      valoresIniciais={valoresIniciais}
      clientes={opcoes.clientes}
      locais={opcoes.locais}
      validadeDias={opcoes.validadeDias}
      visita={visita && visitaOrigem(visita)}
      // Vindo da visita ou da ficha do cliente, "Cancelar" volta para lá.
      cancelarHref={visita ? `/orcamentos/visitas/${visita.id}` : clienteId ? `/clientes/${clienteId}` : "/orcamentos"}
    />
  )
}
