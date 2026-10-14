import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Badge } from "@/components/ui/badge"
import { exigirPerfil } from "@/lib/auth"
import { formatarData, formatarHora } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { NOMES_ESTADO_TRABALHO, VARIANTE_ESTADO_TRABALHO } from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import type { CamposTrabalho } from "@/lib/validacao/trabalhos"
import { AcoesTrabalho } from "../../_componentes/acoes-trabalho"
import { carregarOpcoesTrabalho } from "../../_componentes/dados-formulario"
import { EsqueletoEditarTrabalho } from "../../_componentes/esqueletos"
import { FormularioTrabalho } from "../../_componentes/formulario-trabalho"

export const metadata = { title: "Editar trabalho" }

type Parametros = PageProps<"/trabalhos/[id]/editar">["params"]

export default function PaginaEditarTrabalho(props: PageProps<"/trabalhos/[id]/editar">) {
  return (
    <Suspense fallback={<EsqueletoEditarTrabalho />}>
      <EditarTrabalho params={props.params} />
    </Suspense>
  )
}

async function EditarTrabalho({ params }: { params: Parametros }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: trabalho, error } = await supabase
    .from("trabalhos")
    .select("*, cliente:clientes(nome), local:locais(nome)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Erro ao carregar o trabalho: ${error.message}`)
  if (!trabalho) notFound()

  // Horas, registo ou fotos (as que este perfil vê): a data deixa de se poder mudar (a BD também o recusa).
  const contar = (tabela: "registos_horas" | "registos_trabalho" | "fotos") =>
    supabase.from(tabela).select("id", { count: "exact", head: true }).eq("trabalho_id", trabalho.id)
  const [opcoes, seguintesR, ...atividadeR] = await Promise.all([
    carregarOpcoesTrabalho(supabase, sessao, {
      clienteId: trabalho.cliente_id,
      localId: trabalho.local_id,
      equipaId: trabalho.equipa_id,
    }),
    // Trabalhos da mesma série que ainda podem ser apagados com este.
    trabalho.serie_id
      ? supabase
          .from("trabalhos")
          .select("id", { count: "exact", head: true })
          .eq("serie_id", trabalho.serie_id)
          .gt("data", trabalho.data)
          .eq("estado", "agendado")
      : Promise.resolve({ count: 0 }),
    contar("registos_horas"),
    contar("registos_trabalho"),
    contar("fotos"),
  ])
  const comAtividade = atividadeR.some((r) => (r.count ?? 0) > 0)

  const valoresIniciais: CamposTrabalho = {
    cliente_id: trabalho.cliente_id,
    local_id: trabalho.local_id,
    titulo: trabalho.titulo,
    tipo: trabalho.tipo,
    data: trabalho.data,
    hora_inicio: formatarHora(trabalho.hora_inicio),
    duracao_prevista_min: trabalho.duracao_prevista_min ? String(trabalho.duracao_prevista_min) : "",
    equipa_id: trabalho.equipa_id ?? "",
    descricao: trabalho.descricao ?? "",
    repetir: "nao",
    ate: "",
  }
  const sitio = [trabalho.cliente?.nome, trabalho.local?.nome].filter(Boolean).join(" — ")

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        titulo="Editar trabalho"
        voltar={{ href: `/trabalhos/${trabalho.id}`, texto: trabalho.titulo }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {formatarData(trabalho.data)} · {sitio}
            </span>
            <Badge variant={VARIANTE_ESTADO_TRABALHO[trabalho.estado]}>
              {NOMES_ESTADO_TRABALHO[trabalho.estado]}
            </Badge>
          </span>
        }
        acoes={
          <AcoesTrabalho
            id={trabalho.id}
            titulo={trabalho.titulo}
            estado={trabalho.estado}
            seguintes={seguintesR.count ?? 0}
          />
        }
      />
      {/* A chave volta a montar o formulário se o trabalho mudar entretanto. */}
      <FormularioTrabalho
        key={trabalho.updated_at}
        valoresIniciais={valoresIniciais}
        clientes={opcoes.clientes}
        locais={opcoes.locais}
        equipas={opcoes.equipas}
        permitirSemEquipa={opcoes.permitirSemEquipa}
        trabalho={{ id: trabalho.id, serie: trabalho.serie_id !== null, dataFixa: comAtividade }}
        cancelarHref={`/trabalhos/${trabalho.id}`}
      />
    </div>
  )
}
