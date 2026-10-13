import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { EsqueletoPaginaFormulario } from "../../esqueletos"
import { FormularioCliente } from "../../formulario-cliente"

export const metadata = { title: "Editar cliente" }

type Parametros = PageProps<"/clientes/[id]/editar">["params"]

export default function PaginaEditarCliente(props: PageProps<"/clientes/[id]/editar">) {
  return (
    <Suspense fallback={<EsqueletoPaginaFormulario />}>
      <EditarCliente params={props.params} />
    </Suspense>
  )
}

async function EditarCliente({ params }: { params: Parametros }) {
  await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle()
  if (!cliente) notFound()

  return (
    <div className="max-w-2xl">
      <CabecalhoPagina
        titulo="Editar cliente"
        descricao={cliente.nome}
        voltar={{ href: `/clientes/${cliente.id}`, texto: cliente.nome }}
      />
      {/* A chave volta a montar o formulário se os dados mudarem entretanto. */}
      <FormularioCliente key={cliente.updated_at} cliente={cliente} />
    </div>
  )
}
