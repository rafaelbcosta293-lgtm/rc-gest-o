import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { carregarCategorias } from "../../../_consumiveis/dados"
import { EsqueletoPaginaFormularioConsumivel } from "../../../_consumiveis/esqueletos"
import { FormularioConsumivel } from "../../../_consumiveis/formulario-consumivel"

export const metadata = { title: "Editar consumível" }

type Parametros = PageProps<"/recursos/consumiveis/[id]/editar">["params"]

export default function PaginaEditarConsumivel(props: PageProps<"/recursos/consumiveis/[id]/editar">) {
  return (
    <Suspense fallback={<EsqueletoPaginaFormularioConsumivel />}>
      <EditarConsumivel params={props.params} />
    </Suspense>
  )
}

/** Só o gerente altera consumíveis. */
async function EditarConsumivel({ params }: { params: Parametros }) {
  await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const [consumivelR, precoR, movimentosR, categorias] = await Promise.all([
    supabase
      .from("consumiveis")
      .select("id, nome, categoria, unidade, stock_minimo, ativo, notas, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("consumiveis_precos").select("preco_unitario, updated_at").eq("consumivel_id", id).maybeSingle(),
    supabase.from("movimentos_stock").select("id", { count: "exact", head: true }).eq("consumivel_id", id),
    carregarCategorias(supabase),
  ])
  if (consumivelR.error) throw new Error(`Não foi possível carregar o consumível: ${consumivelR.error.message}`)
  if (precoR.error) throw new Error(`Não foi possível carregar o preço: ${precoR.error.message}`)
  if (movimentosR.error) throw new Error(`Não foi possível carregar os movimentos: ${movimentosR.error.message}`)
  const consumivel = consumivelR.data
  if (!consumivel) notFound()
  const preco = precoR.data

  return (
    <div className="max-w-2xl">
      <CabecalhoPagina
        titulo="Editar consumível"
        descricao={consumivel.nome}
        voltar={{ href: `/recursos/consumiveis/${consumivel.id}`, texto: consumivel.nome }}
      />
      {/* A chave volta a montar o formulário se os dados (ou o preço) mudarem entretanto. */}
      <FormularioConsumivel
        key={`${consumivel.updated_at}|${preco?.updated_at ?? ""}`}
        consumivel={{
          id: consumivel.id,
          nome: consumivel.nome,
          categoria: consumivel.categoria,
          unidade: consumivel.unidade,
          stock_minimo: Number(consumivel.stock_minimo),
          ativo: consumivel.ativo,
          notas: consumivel.notas,
          preco_unitario: preco ? Number(preco.preco_unitario) : null,
        }}
        categorias={categorias}
        unidadeBloqueada={(movimentosR.count ?? 0) > 0}
      />
    </div>
  )
}
