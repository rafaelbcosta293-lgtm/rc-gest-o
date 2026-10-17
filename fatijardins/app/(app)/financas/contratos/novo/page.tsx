import { Suspense } from "react"
import Link from "next/link"
import { TreesIcon } from "lucide-react"

import { carregarOpcoesTrabalho } from "@/app/(app)/trabalhos/_componentes/dados-formulario"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { somarDiasData } from "@/lib/datas"
import { hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import type { CamposContrato } from "@/lib/validacao/contratos"
import { EsqueletoFormularioContrato } from "../../_contratos/esqueletos"
import { FormularioContrato } from "../../_contratos/formulario-contrato"

export const metadata = { title: "Novo contrato" }

type ParametrosPesquisa = PageProps<"/financas/contratos/novo">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

export default function PaginaNovoContrato(props: PageProps<"/financas/contratos/novo">) {
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Novo contrato" voltar={{ href: "/financas/contratos", texto: "Contratos" }} />
      <Suspense fallback={<EsqueletoFormularioContrato />}>
        <NovoContrato searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}

async function NovoContrato({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente")
  const clientePedido = primeiroValor((await searchParams).cliente)
  const supabase = await createClient()
  const opcoes = await carregarOpcoesTrabalho(supabase, sessao)

  if (opcoes.locais.length === 0) {
    return (
      <EstadoVazio
        icone={TreesIcon}
        titulo="Ainda não há clientes com locais"
        descricao="Para registar um contrato, registe primeiro o cliente e o local (jardim) da manutenção."
        acao={
          <Button asChild size="lg">
            <Link href="/clientes/novo">Novo cliente</Link>
          </Button>
        }
      />
    )
  }

  // ?cliente=<id>: o cliente fica escolhido (e o local, se só tiver um).
  const clienteId = opcoes.clientes.some((c) => c.id === clientePedido) ? clientePedido : ""
  const locaisDoCliente = opcoes.locais.filter((local) => local.clienteId === clienteId && local.ativo)

  const valoresIniciais: CamposContrato = {
    cliente_id: clienteId,
    local_id: locaisDoCliente.length === 1 ? locaisDoCliente[0].id : "",
    titulo: "",
    servicos: "",
    frequencia: "semanal",
    // A primeira visita é, por omissão, amanhã.
    data_inicio: somarDiasData(hojeEmLisboa(), 1),
    data_fim: "",
    equipa_id: "",
    hora_inicio: "",
    duracao_prevista_min: "",
    valor_mensal: "",
    taxa_iva: "23",
    dia_cobranca: "8",
    estado: "ativo",
    notas: "",
  }

  return (
    <FormularioContrato
      // Outro cliente pré-escolhido = formulário novo.
      key={clienteId}
      valoresIniciais={valoresIniciais}
      clientes={opcoes.clientes}
      locais={opcoes.locais}
      equipas={opcoes.equipas}
      // Vindo da ficha do cliente, "Cancelar" volta para lá.
      cancelarHref={clienteId ? `/clientes/${clienteId}` : "/financas/contratos"}
    />
  )
}
