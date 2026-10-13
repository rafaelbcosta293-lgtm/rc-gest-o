import { Suspense } from "react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { EsqueletoFormulario } from "../esqueletos"
import { FormularioCliente } from "../formulario-cliente"

export const metadata = { title: "Novo cliente" }

export default function PaginaNovoCliente() {
  return (
    <div className="max-w-2xl">
      <CabecalhoPagina titulo="Novo cliente" voltar={{ href: "/clientes", texto: "Clientes" }} />
      <Suspense fallback={<EsqueletoFormulario />}>
        <Formulario />
      </Suspense>
    </div>
  )
}

async function Formulario() {
  await exigirPerfil("gerente", "chefe_equipa")
  return <FormularioCliente />
}
