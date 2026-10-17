import { Suspense } from "react"
import { notFound } from "next/navigation"

import { carregarOpcoesTrabalho } from "@/app/(app)/trabalhos/_componentes/dados-formulario"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { formatarHora } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio, paraCampo } from "@/lib/validacao/comum"
import type { CamposContrato } from "@/lib/validacao/contratos"
import { EsqueletoEditarContrato } from "../../../_contratos/esqueletos"
import { FormularioContrato } from "../../../_contratos/formulario-contrato"

export const metadata = { title: "Editar contrato" }

type Parametros = PageProps<"/financas/contratos/[id]/editar">["params"]

export default function PaginaEditarContrato(props: PageProps<"/financas/contratos/[id]/editar">) {
  return (
    <Suspense fallback={<EsqueletoEditarContrato />}>
      <EditarContrato params={props.params} />
    </Suspense>
  )
}

async function EditarContrato({ params }: { params: Parametros }) {
  const sessao = await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: contrato, error } = await supabase
    .from("contratos")
    .select("*, cliente:clientes(nome), local:locais(nome)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Erro ao carregar o contrato: ${error.message}`)
  if (!contrato) notFound()

  const opcoes = await carregarOpcoesTrabalho(supabase, sessao, {
    clienteId: contrato.cliente_id,
    localId: contrato.local_id,
    equipaId: contrato.equipa_id,
  })

  const valoresIniciais: CamposContrato = {
    cliente_id: contrato.cliente_id,
    local_id: contrato.local_id,
    titulo: contrato.titulo,
    servicos: contrato.servicos ?? "",
    frequencia: contrato.frequencia,
    data_inicio: contrato.data_inicio,
    data_fim: contrato.data_fim ?? "",
    equipa_id: contrato.equipa_id ?? "",
    hora_inicio: formatarHora(contrato.hora_inicio),
    duracao_prevista_min: contrato.duracao_prevista_min ? String(contrato.duracao_prevista_min) : "",
    valor_mensal: paraCampo(Number(contrato.valor_mensal)),
    taxa_iva: String(Number(contrato.taxa_iva)),
    dia_cobranca: String(contrato.dia_cobranca),
    estado: contrato.estado,
    notas: contrato.notas ?? "",
  }

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        titulo="Editar contrato"
        voltar={{ href: `/financas/contratos/${contrato.id}`, texto: contrato.titulo }}
        descricao={[contrato.cliente?.nome, contrato.local?.nome].filter(Boolean).join(" — ")}
      />
      {/* A chave volta a montar o formulário se o contrato mudar entretanto. */}
      <FormularioContrato
        key={contrato.updated_at}
        valoresIniciais={valoresIniciais}
        clientes={opcoes.clientes}
        locais={opcoes.locais}
        equipas={opcoes.equipas}
        contratoId={contrato.id}
        cancelarHref={`/financas/contratos/${contrato.id}`}
      />
    </div>
  )
}
