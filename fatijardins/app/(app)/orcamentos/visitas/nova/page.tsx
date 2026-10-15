import { Suspense } from "react"
import Link from "next/link"
import { TreesIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import type { CamposVisita } from "@/lib/validacao/visitas"
import { carregarOpcoesVisita } from "../_componentes/dados-formulario"
import { EsqueletoFormularioVisita } from "../_componentes/esqueletos"
import { FormularioVisita } from "../_componentes/formulario-visita"

export const metadata = { title: "Nova visita" }

type ParametrosPesquisa = PageProps<"/orcamentos/visitas/nova">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

export default function PaginaNovaVisita(props: PageProps<"/orcamentos/visitas/nova">) {
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Nova visita" voltar={{ href: "/orcamentos/visitas", texto: "Visitas" }} />
      <Suspense fallback={<EsqueletoFormularioVisita />}>
        <NovaVisita searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}

async function NovaVisita({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const pesquisa = await searchParams
  const supabase = await createClient()
  const opcoes = await carregarOpcoesVisita(supabase)

  if (opcoes.locais.length === 0) {
    return (
      <EstadoVazio
        icone={TreesIcon}
        titulo="Ainda não há clientes com locais"
        descricao="Para marcar uma visita, registe primeiro o cliente e o local (jardim) a visitar."
        acao={
          <Button asChild size="lg">
            <Link href="/clientes/novo">Novo cliente</Link>
          </Button>
        }
      />
    )
  }

  // Pré-preenchimento a partir do endereço (?cliente=&local=), ex.: vindo da ficha do cliente.
  const local = opcoes.locais.find((l) => l.id === primeiroValor(pesquisa.local))
  const cliente = opcoes.clientes.find((c) => c.id === (local?.clienteId ?? primeiroValor(pesquisa.cliente)))
  const locaisDoCliente = cliente ? opcoes.locais.filter((l) => l.clienteId === cliente.id && l.ativo) : []
  // Com um só local, fica escolhido.
  const localInicial = local ?? (locaisDoCliente.length === 1 ? locaisDoCliente[0] : undefined)
  // Quem cria é o responsável proposto.
  const responsavel = opcoes.responsaveis.some((r) => r.id === sessao.colaborador.id) ? sessao.colaborador.id : ""

  const valoresIniciais: CamposVisita = {
    cliente_id: cliente?.id ?? "",
    local_id: localInicial?.id ?? "",
    data: hojeEmLisboa(),
    hora: "",
    responsavel_id: responsavel,
    area_m2: "",
    medidas: "",
    notas: "",
  }

  return (
    <FormularioVisita
      // Outro pré-preenchimento (vindo de outro cliente) = formulário novo.
      key={`${valoresIniciais.cliente_id}|${valoresIniciais.local_id}`}
      valoresIniciais={valoresIniciais}
      clientes={opcoes.clientes}
      locais={opcoes.locais}
      responsaveis={opcoes.responsaveis}
      cancelarHref={cliente ? `/clientes/${cliente.id}` : "/orcamentos/visitas"}
    />
  )
}
