import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { formatarHora } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio, paraCampo } from "@/lib/validacao/comum"
import type { CamposVisita } from "@/lib/validacao/visitas"
import { formatarQuandoVisita, nomeSitioVisita } from "@/lib/visitas"
import { carregarOpcoesVisita } from "../../_componentes/dados-formulario"
import { EsqueletoEditarVisita } from "../../_componentes/esqueletos"
import { FormularioVisita } from "../../_componentes/formulario-visita"

export const metadata = { title: "Editar visita" }

type Parametros = PageProps<"/orcamentos/visitas/[id]/editar">["params"]

export default function PaginaEditarVisita(props: PageProps<"/orcamentos/visitas/[id]/editar">) {
  return (
    <Suspense fallback={<EsqueletoEditarVisita />}>
      <EditarVisita params={props.params} />
    </Suspense>
  )
}

async function EditarVisita({ params }: { params: Parametros }) {
  await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: visita, error } = await supabase
    .from("visitas")
    .select("*, cliente:clientes(nome), local:locais(nome)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Erro ao carregar a visita: ${error.message}`)
  if (!visita) notFound()

  const opcoes = await carregarOpcoesVisita(supabase, {
    clienteId: visita.cliente_id,
    localId: visita.local_id,
    responsavelId: visita.responsavel_id,
  })

  const valoresIniciais: CamposVisita = {
    cliente_id: visita.cliente_id,
    local_id: visita.local_id,
    data: visita.data,
    hora: formatarHora(visita.hora),
    responsavel_id: visita.responsavel_id ?? "",
    area_m2: paraCampo(visita.area_m2),
    medidas: visita.medidas ?? "",
    notas: visita.notas ?? "",
  }

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        titulo="Editar visita"
        voltar={{ href: `/orcamentos/visitas/${visita.id}`, texto: "Visita" }}
        descricao={`${formatarQuandoVisita(visita.data, visita.hora)} · ${nomeSitioVisita(visita.cliente?.nome, visita.local?.nome)}`}
      />
      {/* A chave volta a montar o formulário se a visita mudar entretanto. */}
      <FormularioVisita
        key={visita.updated_at}
        valoresIniciais={valoresIniciais}
        clientes={opcoes.clientes}
        locais={opcoes.locais}
        responsaveis={opcoes.responsaveis}
        visitaId={visita.id}
        cancelarHref={`/orcamentos/visitas/${visita.id}`}
      />
    </div>
  )
}
