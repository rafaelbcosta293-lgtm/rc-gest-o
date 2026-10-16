import { Suspense } from "react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { carregarCategorias } from "../../_consumiveis/dados"
import { EsqueletoFormularioConsumivel } from "../../_consumiveis/esqueletos"
import { FormularioConsumivel } from "../../_consumiveis/formulario-consumivel"

export const metadata = { title: "Novo consumível" }

export default function PaginaNovoConsumivel() {
  return (
    <div className="max-w-2xl">
      <CabecalhoPagina titulo="Novo consumível" voltar={{ href: "/recursos/consumiveis", texto: "Consumíveis" }} />
      <Suspense fallback={<EsqueletoFormularioConsumivel />}>
        <Formulario />
      </Suspense>
    </div>
  )
}

/** Só o gerente cria consumíveis. */
async function Formulario() {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const categorias = await carregarCategorias(supabase)
  return <FormularioConsumivel categorias={categorias} />
}
