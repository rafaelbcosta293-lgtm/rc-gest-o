import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio, paraCampo } from "@/lib/validacao/comum"
import { FormularioColaborador } from "../../../_componentes/formulario-colaborador"
import { EsqueletoFormulario } from "../../../_componentes/esqueletos"

type Props = PageProps<"/equipa/colaboradores/[id]/editar">

export const metadata = { title: "Editar colaborador" }

export default function PaginaEditarColaborador(props: Props) {
  return (
    <Suspense fallback={<EsqueletoFormulario comCabecalho />}>
      <EditarColaborador params={props.params} />
    </Suspense>
  )
}

async function EditarColaborador({ params }: { params: Props["params"] }) {
  const sessao = await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const [colaboradorRes, custoRes, equipasRes] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("id, nome, funcao, perfil, telemovel, email, equipa_id, ativo")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("colaboradores_custos").select("custo_hora").eq("colaborador_id", id).maybeSingle(),
    supabase.from("equipas").select("id, nome, ativa").order("nome"),
  ])
  if (colaboradorRes.error) throw new Error(`Erro ao ler o colaborador: ${colaboradorRes.error.message}`)
  if (equipasRes.error) throw new Error(`Erro ao ler as equipas: ${equipasRes.error.message}`)
  const colaborador = colaboradorRes.data
  if (!colaborador) notFound()

  // Equipas ativas, mais a atual se entretanto tiver sido desativada.
  const equipas = equipasRes.data.filter((e) => e.ativa || e.id === colaborador.equipa_id)
  const custo = custoRes.data?.custo_hora
  const ficha = `/equipa/colaboradores/${colaborador.id}`

  return (
    <>
      <CabecalhoPagina titulo="Editar colaborador" descricao={colaborador.nome} voltar={{ href: ficha }} />
      <FormularioColaborador
        colaboradorId={colaborador.id}
        equipas={equipas}
        eProprio={colaborador.id === sessao.colaborador.id}
        cancelarHref={ficha}
        valoresIniciais={{
          nome: colaborador.nome,
          funcao: paraCampo(colaborador.funcao),
          perfil: colaborador.perfil,
          telemovel: paraCampo(colaborador.telemovel),
          email: paraCampo(colaborador.email),
          equipaId: paraCampo(colaborador.equipa_id),
          custoHora: custo === undefined ? "" : custo.toFixed(2).replace(".", ","),
          ativo: colaborador.ativo,
        }}
      />
    </>
  )
}
