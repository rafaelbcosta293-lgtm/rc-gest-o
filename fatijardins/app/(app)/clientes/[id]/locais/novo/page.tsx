import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { EsqueletoPaginaFormulario } from "../../../esqueletos"
import { FormularioLocal } from "../../../formulario-local"

export const metadata = { title: "Novo local" }

type Parametros = PageProps<"/clientes/[id]/locais/novo">["params"]

export default function PaginaNovoLocal(props: PageProps<"/clientes/[id]/locais/novo">) {
  return (
    <Suspense fallback={<EsqueletoPaginaFormulario />}>
      <NovoLocal params={props.params} />
    </Suspense>
  )
}

async function NovoLocal({ params }: { params: Parametros }) {
  await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome, morada, codigo_postal, localidade")
    .eq("id", id)
    .maybeSingle()
  if (!cliente) notFound()

  return (
    <div className="max-w-2xl">
      <CabecalhoPagina
        titulo="Novo local"
        descricao={cliente.nome}
        voltar={{ href: `/clientes/${cliente.id}`, texto: cliente.nome }}
      />
      {cliente.morada && (
        <p className="mb-4 text-sm text-muted-foreground">
          A morada foi preenchida com a morada de faturação do cliente. Altere-a se o jardim for
          noutro sítio.
        </p>
      )}
      <FormularioLocal
        clienteId={cliente.id}
        moradaCliente={{
          morada: cliente.morada,
          codigo_postal: cliente.codigo_postal,
          localidade: cliente.localidade,
        }}
      />
    </div>
  )
}
