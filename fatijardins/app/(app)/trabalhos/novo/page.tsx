import { Suspense } from "react"
import Link from "next/link"
import { TreesIcon, UsersIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { eDataValida } from "@/lib/datas"
import { hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import type { CamposTrabalho } from "@/lib/validacao/trabalhos"
import { carregarOpcoesTrabalho } from "../_componentes/dados-formulario"
import { EsqueletoFormularioTrabalho } from "../_componentes/esqueletos"
import { FormularioTrabalho } from "../_componentes/formulario-trabalho"

export const metadata = { title: "Novo trabalho" }

type ParametrosPesquisa = PageProps<"/trabalhos/novo">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

export default function PaginaNovoTrabalho(props: PageProps<"/trabalhos/novo">) {
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Novo trabalho" voltar={{ href: "/agenda", texto: "Agenda" }} />
      <Suspense fallback={<EsqueletoFormularioTrabalho />}>
        <NovoTrabalho searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}

async function NovoTrabalho({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const pesquisa = await searchParams
  const supabase = await createClient()
  const opcoes = await carregarOpcoesTrabalho(supabase, sessao)

  if (opcoes.equipas.length === 0 && !opcoes.permitirSemEquipa) {
    return (
      <EstadoVazio
        icone={UsersIcon}
        titulo="Não chefia nenhuma equipa"
        descricao="Só pode agendar trabalhos nas equipas que chefia. Fale com o gerente."
      />
    )
  }
  if (opcoes.locais.length === 0) {
    return (
      <EstadoVazio
        icone={TreesIcon}
        titulo="Ainda não há clientes com locais"
        descricao="Para agendar um trabalho, registe primeiro o cliente e o local (jardim) onde se vai trabalhar."
        acao={
          <Button asChild size="lg">
            <Link href="/clientes/novo">Novo cliente</Link>
          </Button>
        }
      />
    )
  }

  // Pré-preenchimento a partir do endereço (?data=&equipa=&local=).
  const data = primeiroValor(pesquisa.data)
  const equipa = primeiroValor(pesquisa.equipa)
  const local = opcoes.locais.find((l) => l.id === primeiroValor(pesquisa.local))
  const equipaValida = opcoes.equipas.some((e) => e.id === equipa)
  // O chefe com uma só equipa não precisa de a escolher.
  const equipaInicial = equipaValida
    ? equipa
    : !opcoes.permitirSemEquipa && opcoes.equipas.length === 1
      ? opcoes.equipas[0].id
      : ""

  const valoresIniciais: CamposTrabalho = {
    cliente_id: local?.clienteId ?? "",
    local_id: local?.id ?? "",
    titulo: "",
    tipo: "manutencao",
    data: eDataValida(data) ? data : hojeEmLisboa(),
    hora_inicio: "",
    duracao_prevista_min: "",
    equipa_id: equipaInicial,
    descricao: "",
    repetir: "nao",
    ate: "",
  }

  return (
    <FormularioTrabalho
      // Outro pré-preenchimento (vindo de outra célula da agenda) = formulário novo.
      key={`${valoresIniciais.data}|${valoresIniciais.equipa_id}|${valoresIniciais.local_id}`}
      valoresIniciais={valoresIniciais}
      clientes={opcoes.clientes}
      locais={opcoes.locais}
      equipas={opcoes.equipas}
      permitirSemEquipa={opcoes.permitirSemEquipa}
      cancelarHref="/agenda"
    />
  )
}
