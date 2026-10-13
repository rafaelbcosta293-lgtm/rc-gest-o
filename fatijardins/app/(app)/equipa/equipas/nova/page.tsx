import { Suspense } from "react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { EsqueletoFormulario } from "../../_componentes/esqueletos"
import { FormularioEquipa } from "../../_componentes/formulario-equipa"

export const metadata = { title: "Nova equipa" }

export default function PaginaNovaEquipa() {
  return (
    <>
      <CabecalhoPagina titulo="Nova equipa" voltar={{ href: "/equipa/equipas", texto: "Equipas" }} />
      <Suspense fallback={<EsqueletoFormulario />}>
        <NovaEquipa />
      </Suspense>
    </>
  )
}

async function NovaEquipa() {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const { data: chefes, error } = await supabase
    .from("colaboradores")
    .select("id, nome, perfil")
    .eq("ativo", true)
    .in("perfil", ["chefe_equipa", "gerente"])
    .order("nome")
  if (error) throw new Error(`Erro ao ler os colaboradores: ${error.message}`)

  return (
    <FormularioEquipa
      chefes={chefes}
      cancelarHref="/equipa/equipas"
      valoresIniciais={{ nome: "", cor: "#15803d", chefeId: "", ativa: true, notas: "" }}
    />
  )
}
