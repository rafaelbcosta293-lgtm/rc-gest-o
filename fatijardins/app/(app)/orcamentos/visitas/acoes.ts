"use server"

import { revalidatePath } from "next/cache"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao, type Sessao } from "@/lib/auth"
import { eGerente, eGerenteOuChefe } from "@/lib/perfis"
import type { TablesUpdate } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { BUCKET_FOTOS } from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaFotoVisita,
  esquemaLegendaFoto,
  esquemaVisita,
  type CamposVisita,
  type DadosFotoVisita,
  type DadosVisita,
} from "@/lib/validacao/visitas"
import { caminhoFicheiroVisita, eCaminhoFotoVisita } from "@/lib/visitas"

type Supabase = Awaited<ReturnType<typeof createClient>>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "A visita não existe ou não tem acesso a ela.",
}

const FOTO_NAO_EXISTE: ResultadoAcao<never> = { ok: false, erro: "A foto já não existe." }

/** Sessão de gerente ou chefe de equipa (quem faz visitas); null nos outros casos. */
async function sessaoGestor(): Promise<Sessao | null> {
  const sessao = await obterSessao()
  return sessao && eGerenteOuChefe(sessao.colaborador.perfil) ? sessao : null
}

/** As listas e fichas de visitas e orçamentos, o histórico do cliente e o Início. */
function revalidarVisitas() {
  revalidatePath("/orcamentos", "layout")
  revalidatePath("/clientes/[id]", "page")
  revalidatePath("/")
}

function erroCampo(campo: keyof CamposVisita, mensagem: string): ResultadoAcao<never> {
  return { ok: false, erro: mensagem, campos: { [campo]: [mensagem] } }
}

/** O local tem de pertencer ao cliente escolhido (e estar ativo, salvo se já era o da visita). */
async function validarLocal(
  supabase: Supabase,
  dados: DadosVisita,
  localAtual?: string
): Promise<{ ok: true; clienteId: string } | { ok: false; resultado: ResultadoAcao<never> }> {
  const { data: local, error } = await supabase
    .from("locais")
    .select("id, cliente_id, ativo")
    .eq("id", dados.local_id)
    .maybeSingle()
  if (error) return { ok: false, resultado: erroBD(error) }
  if (!local || local.cliente_id !== dados.cliente_id) {
    return { ok: false, resultado: erroCampo("local_id", "Escolha um local deste cliente.") }
  }
  if (!local.ativo && local.id !== localAtual) {
    return { ok: false, resultado: erroCampo("local_id", "Este local está desativado. Escolha outro.") }
  }
  return { ok: true, clienteId: local.cliente_id }
}

/** O responsável é o gerente ou um chefe de equipa ativo (ou o que a visita já tinha). */
async function validarResponsavel(
  supabase: Supabase,
  responsavelId: string,
  atual?: string | null
): Promise<ResultadoAcao<never> | null> {
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, perfil, ativo")
    .eq("id", responsavelId)
    .maybeSingle()
  if (error) return erroBD(error)
  if (!data || (data.id !== atual && (!data.ativo || !eGerenteOuChefe(data.perfil)))) {
    return erroCampo("responsavel_id", "Escolha o gerente ou um chefe de equipa ativo.")
  }
  return null
}

const MENSAGENS_GRAVAR = { emUso: "O local ou o responsável já não existem. Atualize a página." }

// ---------------------------------------------------------------------
// Criar, editar e apagar
// ---------------------------------------------------------------------

export async function criarVisita(valores: CamposVisita): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const dados = esquemaVisita.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const visita = dados.data

  const supabase = await createClient()
  const local = await validarLocal(supabase, visita)
  if (!local.ok) return local.resultado
  const problemaResponsavel = await validarResponsavel(supabase, visita.responsavel_id)
  if (problemaResponsavel) return problemaResponsavel

  // Quem cria (criado_por) é definido pela BD.
  const { data, error } = await supabase
    .from("visitas")
    .insert({
      local_id: visita.local_id,
      cliente_id: local.clienteId,
      data: visita.data,
      hora: visita.hora,
      responsavel_id: visita.responsavel_id,
      area_m2: visita.area_m2,
      medidas: visita.medidas,
      notas: visita.notas,
    })
    .select("id")
    .single()
  if (error) return erroBD(error, MENSAGENS_GRAVAR)

  revalidarVisitas()
  return { ok: true, mensagem: "Visita criada.", redirecionar: `/orcamentos/visitas/${data.id}` }
}

export async function atualizarVisita(id: string, valores: CamposVisita): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const visitaId = idObrigatorio.safeParse(id)
  if (!visitaId.success) return NAO_EXISTE
  const dados = esquemaVisita.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const visita = dados.data

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("visitas")
    .select("id, local_id, responsavel_id")
    .eq("id", visitaId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE

  const local = await validarLocal(supabase, visita, atual.local_id)
  if (!local.ok) return local.resultado
  const problemaResponsavel = await validarResponsavel(supabase, visita.responsavel_id, atual.responsavel_id)
  if (problemaResponsavel) return problemaResponsavel

  const alteracoes: TablesUpdate<"visitas"> = {
    local_id: visita.local_id,
    cliente_id: local.clienteId,
    data: visita.data,
    hora: visita.hora,
    responsavel_id: visita.responsavel_id,
    area_m2: visita.area_m2,
    medidas: visita.medidas,
    notas: visita.notas,
  }
  const { data, error } = await supabase.from("visitas").update(alteracoes).eq("id", atual.id).select("id")
  if (error) return erroBD(error, MENSAGENS_GRAVAR)
  if (data.length === 0) return NAO_EXISTE

  revalidarVisitas()
  return { ok: true, mensagem: "Visita guardada.", redirecionar: `/orcamentos/visitas/${atual.id}` }
}

/**
 * Apaga a visita: primeiro as fotos (linhas e ficheiros), depois a visita.
 * Os orçamentos em rascunho feitos a partir dela ficam sem visita; os já
 * enviados, aceites ou recusados não se alteram, por isso a visita fica.
 */
export async function apagarVisita(id: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const visitaId = idObrigatorio.safeParse(id)
  if (!visitaId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: visita, error: erroLer } = await supabase
    .from("visitas")
    .select("id, criado_por")
    .eq("id", visitaId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!visita) return NAO_EXISTE
  // Apaga o gerente ou quem criou a visita (a BD também o impõe). Verificado antes de apagar as fotos.
  if (!eGerente(sessao.colaborador.perfil) && visita.criado_por !== sessao.colaborador.id) {
    return { ok: false, erro: "Só o gerente ou quem criou a visita a pode apagar." }
  }

  const { data: orcamentos, error: erroOrcamentos } = await supabase
    .from("orcamentos")
    .select("id, estado")
    .eq("visita_id", visita.id)
  if (erroOrcamentos) return erroBD(erroOrcamentos)
  if (orcamentos.some((orcamento) => orcamento.estado !== "rascunho")) {
    return {
      ok: false,
      erro: "Esta visita não pode ser apagada: tem orçamentos já enviados, aceites ou recusados, que não podem ser alterados.",
    }
  }

  // 1. As linhas das fotos (a BD não deixa apagar uma visita com fotos).
  const { data: fotos, error: erroFotos } = await supabase
    .from("fotos")
    .delete()
    .eq("visita_id", visita.id)
    .select("caminho")
  if (erroFotos) return erroBD(erroFotos)

  // 2. Os ficheiros da pasta da visita (também os que ficaram por registar). Têm de sair antes da
  // visita: sem ela, a RLS do Storage já não os deixa apagar. Só se apagam ficheiros desta pasta.
  const { data: naPasta, error: erroListar } = await supabase.storage
    .from(BUCKET_FOTOS)
    .list(`visitas/${visita.id}`, { limit: 1000 })
  if (erroListar) console.error("Não foi possível listar as fotos da visita:", visita.id, erroListar.message)
  const caminhos = new Set([
    ...fotos.map((foto) => foto.caminho),
    ...(naPasta ?? []).map((ficheiro) => caminhoFicheiroVisita(visita.id, ficheiro.name)),
  ])
  const aApagar = [...caminhos].filter((caminho) => eCaminhoFotoVisita(visita.id, caminho))
  if (aApagar.length > 0) {
    const { error: erroRemover } = await supabase.storage.from(BUCKET_FOTOS).remove(aApagar)
    if (erroRemover) console.error("Não foi possível apagar os ficheiros da visita:", visita.id, erroRemover.message)
  }

  // 3. A visita (a BD tira-a dos orçamentos em rascunho).
  const { data, error } = await supabase.from("visitas").delete().eq("id", visita.id).select("id")
  if (error) {
    revalidarVisitas()
    return erroBD(error, { emUso: "Entretanto foi acrescentada uma foto a esta visita. Tente de novo." })
  }
  if (data.length === 0) return SEM_PERMISSAO

  revalidarVisitas()
  return { ok: true, mensagem: "Visita apagada.", redirecionar: "/orcamentos/visitas" }
}

// ---------------------------------------------------------------------
// Fotos (o browser envia o ficheiro para o Storage e depois regista-o aqui)
// ---------------------------------------------------------------------

type Contexto = { sessao: Sessao; supabase: Supabase; visitaId: string }

/** Sessão de gerente/chefe, id válido e visita visível (a RLS decide). */
async function prepararVisita(id: string): Promise<{ contexto: Contexto } | { falha: ResultadoAcao<never> }> {
  const sessao = await sessaoGestor()
  if (!sessao) return { falha: SEM_PERMISSAO }
  const visitaId = idObrigatorio.safeParse(id)
  if (!visitaId.success) return { falha: NAO_EXISTE }

  const supabase = await createClient()
  const { data, error } = await supabase.from("visitas").select("id").eq("id", visitaId.data).maybeSingle()
  if (error) return { falha: erroBD(error) }
  if (!data) return { falha: NAO_EXISTE }
  // O id tal como está na BD (minúsculas): é com ele que se comparam os caminhos no Storage.
  return { contexto: { sessao, supabase, visitaId: data.id } }
}

export async function registarFotoVisita(id: string, dadosFoto: DadosFotoVisita): Promise<ResultadoAcao> {
  const preparado = await prepararVisita(id)
  if ("falha" in preparado) return preparado.falha
  const { sessao, supabase, visitaId } = preparado.contexto

  const dados = esquemaFotoVisita.safeParse(dadosFoto)
  if (!dados.success || !eCaminhoFotoVisita(visitaId, dados.data.caminho)) {
    return { ok: false, erro: "Os dados da foto não são válidos." }
  }

  // Confirma que o ficheiro chegou ao Storage (e usa o tamanho real).
  const { data: ficheiro, error: erroFicheiro } = await supabase.storage
    .from(BUCKET_FOTOS)
    .info(dados.data.caminho)
  if (erroFicheiro || !ficheiro) {
    return { ok: false, erro: "A foto não chegou ao servidor. Tente de novo." }
  }

  const { error } = await supabase.from("fotos").insert({
    visita_id: visitaId,
    momento: "outra",
    caminho: dados.data.caminho,
    largura: dados.data.largura,
    altura: dados.data.altura,
    tamanho_bytes: ficheiro.size && ficheiro.size > 0 ? ficheiro.size : dados.data.tamanho,
    colaborador_id: sessao.colaborador.id,
  })
  // 23505: a mesma foto já ficou registada numa tentativa anterior (falha de rede na resposta).
  if (error && error.code !== "23505") return erroBD(error)

  revalidarVisitas()
  return { ok: true, mensagem: "Foto guardada." }
}

export async function apagarFotoVisita(id: string, fotoId: string): Promise<ResultadoAcao> {
  const preparado = await prepararVisita(id)
  if ("falha" in preparado) return preparado.falha
  const { supabase, visitaId } = preparado.contexto

  const fotoValida = idObrigatorio.safeParse(fotoId)
  if (!fotoValida.success) return FOTO_NAO_EXISTE

  // Primeiro a linha, depois o ficheiro: nunca fica uma foto a apontar para um ficheiro que já não existe.
  const { data, error } = await supabase
    .from("fotos")
    .delete()
    .eq("id", fotoValida.data)
    .eq("visita_id", visitaId)
    .select("caminho")
  if (error) return erroBD(error)
  const foto = data[0]
  if (!foto) return FOTO_NAO_EXISTE

  // Só se apaga um ficheiro da pasta desta visita (um caminho de outro sítio, que a BD já não
  // aceita, deixaria apagar o ficheiro de outra visita ou de um trabalho): aí sai só a linha.
  if (eCaminhoFotoVisita(visitaId, foto.caminho)) {
    const { error: erroRemover } = await supabase.storage.from(BUCKET_FOTOS).remove([foto.caminho])
    if (erroRemover) console.error("Não foi possível apagar o ficheiro da foto:", foto.caminho, erroRemover.message)
  } else {
    console.error("Foto com um caminho fora da pasta da visita; o ficheiro não foi apagado:", foto.caminho)
  }

  revalidarVisitas()
  return { ok: true, mensagem: "Foto apagada." }
}

export async function guardarLegendaFoto(id: string, fotoId: string, legenda: string): Promise<ResultadoAcao> {
  const preparado = await prepararVisita(id)
  if ("falha" in preparado) return preparado.falha
  const { supabase, visitaId } = preparado.contexto

  const fotoValida = idObrigatorio.safeParse(fotoId)
  if (!fotoValida.success) return FOTO_NAO_EXISTE
  const texto = esquemaLegendaFoto.safeParse(legenda)
  if (!texto.success) return { ok: false, erro: texto.error.issues[0]?.message ?? "Legenda inválida." }

  const { data, error } = await supabase
    .from("fotos")
    .update({ legenda: texto.data })
    .eq("id", fotoValida.data)
    .eq("visita_id", visitaId)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return FOTO_NAO_EXISTE

  revalidarVisitas()
  return { ok: true, mensagem: texto.data ? "Legenda guardada." : "Legenda apagada." }
}
