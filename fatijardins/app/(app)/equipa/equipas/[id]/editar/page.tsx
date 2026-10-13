import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio, paraCampo } from "@/lib/validacao/comum"
import { FormularioEquipa } from "../../../_componentes/formulario-equipa"
import { EsqueletoFormulario } from "../../../_componentes/esqueletos"

type Props = PageProps<"/equipa/equipas/[id]/editar">

export const metadata = { title: "Editar equipa" }

export default function PaginaEditarEquipa(props: Props) {
  return (
    <Suspense fallback={<EsqueletoFormulario comCabecalho />}>
      <EditarEquipa params={props.params} />
    </Suspense>
  )
}

async function EditarEquipa({ params }: { params: Props["params"] }) {
  await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const [equipaRes, chefesRes] = await Promise.all([
    supabase.from("equipas").select("id, nome, cor, chefe_id, ativa, notas").eq("id", id).maybeSingle(),
    supabase
      .from("colaboradores")
      .select("id, nome, perfil, ativo")
      .order("nome"),
  ])
  if (equipaRes.error) throw new Error(`Erro ao ler a equipa: ${equipaRes.error.message}`)
  if (chefesRes.error) throw new Error(`Erro ao ler os colaboradores: ${chefesRes.error.message}`)
  const equipa = equipaRes.data
  if (!equipa) notFound()

  // Quem pode chefiar, mais o chefe atual (mesmo que tenha mudado de perfil).
  const chefes = chefesRes.data.filter(
    (c) => (c.ativo && (c.perfil === "chefe_equipa" || c.perfil === "gerente")) || c.id === equipa.chefe_id
  )
  const detalhe = `/equipa/equipas/${equipa.id}`

  return (
    <>
      <CabecalhoPagina titulo="Editar equipa" descricao={equipa.nome} voltar={{ href: detalhe }} />
      <FormularioEquipa
        equipaId={equipa.id}
        chefes={chefes}
        cancelarHref={detalhe}
        valoresIniciais={{
          nome: equipa.nome,
          cor: equipa.cor,
          chefeId: paraCampo(equipa.chefe_id),
          ativa: equipa.ativa,
          notas: paraCampo(equipa.notas),
        }}
      />
    </>
  )
}
