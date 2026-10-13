import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { apagarLocal } from "../../../../acoes"
import { BotaoApagar } from "../../../../botao-apagar"
import { EsqueletoPaginaFormulario } from "../../../../esqueletos"
import { FormularioLocal } from "../../../../formulario-local"

export const metadata = { title: "Editar local" }

type Parametros = PageProps<"/clientes/[id]/locais/[localId]/editar">["params"]

export default function PaginaEditarLocal(props: PageProps<"/clientes/[id]/locais/[localId]/editar">) {
  return (
    <Suspense fallback={<EsqueletoPaginaFormulario />}>
      <EditarLocal params={props.params} />
    </Suspense>
  )
}

async function EditarLocal({ params }: { params: Parametros }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const { id, localId } = await params
  if (!idObrigatorio.safeParse(id).success || !idObrigatorio.safeParse(localId).success) notFound()

  const supabase = await createClient()
  const { data: local } = await supabase
    .from("locais")
    .select("*, cliente:clientes(nome)")
    .eq("id", localId)
    .eq("cliente_id", id)
    .maybeSingle()
  if (!local) notFound()

  const { cliente, ...dadosLocal } = local
  const nomeCliente = cliente?.nome ?? "Cliente"

  return (
    <div className="max-w-2xl">
      <CabecalhoPagina
        titulo="Editar local"
        descricao={`${dadosLocal.nome} · ${nomeCliente}`}
        voltar={{ href: `/clientes/${id}`, texto: nomeCliente }}
        acoes={
          eGerente(sessao.colaborador.perfil) && (
            <BotaoApagar
              acao={apagarLocal.bind(null, id, localId)}
              titulo="Apagar este local?"
              descricao={
                <>
                  Vai apagar o local <strong>{dadosLocal.nome}</strong> ({dadosLocal.morada}). Esta
                  ação não pode ser desfeita. Se já não se trabalha lá, é preferível desativá-lo.
                </>
              }
            />
          )
        }
      />
      {/* A chave volta a montar o formulário se os dados mudarem entretanto. */}
      <FormularioLocal key={dadosLocal.updated_at} clienteId={id} local={dadosLocal} />
    </div>
  )
}
