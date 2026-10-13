import { Suspense } from "react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { EsqueletoFormulario } from "../../_componentes/esqueletos"
import { FormularioColaborador } from "../../_componentes/formulario-colaborador"

export const metadata = { title: "Novo colaborador" }

export default function PaginaNovoColaborador() {
  return (
    <>
      <CabecalhoPagina titulo="Novo colaborador" voltar={{ href: "/equipa", texto: "Colaboradores" }} />
      <Suspense fallback={<EsqueletoFormulario />}>
        <NovoColaborador />
      </Suspense>
    </>
  )
}

async function NovoColaborador() {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const { data: equipas, error } = await supabase
    .from("equipas")
    .select("id, nome, ativa")
    .eq("ativa", true)
    .order("nome")
  if (error) throw new Error(`Erro ao ler as equipas: ${error.message}`)

  return (
    <FormularioColaborador
      equipas={equipas}
      cancelarHref="/equipa"
      valoresIniciais={{
        nome: "",
        funcao: "",
        perfil: "colaborador",
        telemovel: "",
        email: "",
        equipaId: "",
        custoHora: "",
        ativo: true,
      }}
    />
  )
}
