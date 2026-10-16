import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { NOMES_TIPO_EQUIPAMENTO } from "@/lib/recursos"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import type { CamposEquipamento } from "@/lib/validacao/equipamentos"
import { carregarOpcoesEquipamento } from "../../../_equipamentos/dados"
import { EsqueletoFormularioEquipamento } from "../../../_equipamentos/esqueletos"
import { FormularioEquipamento } from "../../../_equipamentos/formulario-equipamento"

export const metadata = { title: "Editar equipamento" }

type Parametros = PageProps<"/recursos/equipamentos/[id]/editar">["params"]

export default function PaginaEditarEquipamento(props: PageProps<"/recursos/equipamentos/[id]/editar">) {
  return (
    <Suspense fallback={<EsqueletoFormularioEquipamento />}>
      <EditarEquipamento params={props.params} />
    </Suspense>
  )
}

async function EditarEquipamento({ params }: { params: Parametros }) {
  await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: equipamento, error } = await supabase.from("equipamentos").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`Erro ao carregar o equipamento: ${error.message}`)
  if (!equipamento) notFound()

  const opcoes = await carregarOpcoesEquipamento(supabase, {
    equipaId: equipamento.equipa_id,
    colaboradorId: equipamento.colaborador_id,
  })

  const valoresIniciais: CamposEquipamento = {
    nome: equipamento.nome,
    tipo: equipamento.tipo,
    marca: equipamento.marca ?? "",
    modelo: equipamento.modelo ?? "",
    numero_serie: equipamento.numero_serie ?? "",
    matricula: equipamento.matricula ?? "",
    estado: equipamento.estado,
    equipa_id: equipamento.equipa_id ?? "",
    colaborador_id: equipamento.colaborador_id ?? "",
    data_aquisicao: equipamento.data_aquisicao ?? "",
    proxima_revisao: equipamento.proxima_revisao ?? "",
    seguro_ate: equipamento.seguro_ate ?? "",
    ipo_ate: equipamento.ipo_ate ?? "",
    notas: equipamento.notas ?? "",
  }

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        titulo="Editar equipamento"
        voltar={{ href: `/recursos/equipamentos/${equipamento.id}`, texto: equipamento.nome }}
        descricao={[
          NOMES_TIPO_EQUIPAMENTO[equipamento.tipo],
          [equipamento.marca, equipamento.modelo].filter(Boolean).join(" "),
          equipamento.matricula,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      {/* A chave volta a montar o formulário se o equipamento mudar entretanto. */}
      <FormularioEquipamento
        key={equipamento.updated_at}
        valoresIniciais={valoresIniciais}
        equipas={opcoes.equipas}
        colaboradores={opcoes.colaboradores}
        equipamentoId={equipamento.id}
        cancelarHref={`/recursos/equipamentos/${equipamento.id}`}
      />
    </div>
  )
}
