"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao, type Sessao } from "@/lib/auth"
import { eGerenteOuChefe } from "@/lib/perfis"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { BUCKET_FOTOS, NOMES_ESTADO_TRABALHO, type EstadoTrabalho } from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  eCaminhoAssinatura,
  eCaminhoFoto,
  esquemaAssinatura,
  esquemaEstado,
  esquemaFoto,
  esquemaMaterial,
  esquemaRegisto,
  esquemaVersaoRegisto,
  MENSAGEM_CONFLITO_REGISTO,
  type CamposMaterial,
  type CamposRegisto,
  type DadosFoto,
} from "@/lib/validacao/registos"

type Cliente = SupabaseClient<Database>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O trabalho não existe ou não tem acesso a ele.",
}

const JA_ASSINADO: ResultadoAcao<never> = {
  ok: false,
  erro: "Este trabalho já tem uma assinatura. Só o gerente ou o chefe de equipa a podem apagar.",
}

/** Atualiza a ficha, o Início (O meu dia) e a agenda. */
function revalidar(trabalhoId: string) {
  revalidatePath(`/trabalhos/${trabalhoId}`)
  revalidatePath("/")
  revalidatePath("/agenda", "layout")
}

type Contexto = { sessao: Sessao; supabase: Cliente; trabalhoId: string }

/**
 * Verificações comuns: sessão ativa, id válido e trabalho visível para o
 * utilizador (a RLS decide: gerente, chefe da equipa ou colaborador da
 * equipa no próprio dia).
 */
async function prepararTrabalho(id: string): Promise<{ contexto: Contexto } | { falha: ResultadoAcao<never> }> {
  const sessao = await obterSessao()
  if (!sessao) return { falha: SEM_PERMISSAO }
  const trabalhoId = idObrigatorio.safeParse(id)
  if (!trabalhoId.success) return { falha: NAO_EXISTE }

  const supabase = await createClient()
  const { data, error } = await supabase.from("trabalhos").select("id").eq("id", trabalhoId.data).maybeSingle()
  if (error) return { falha: erroBD(error) }
  if (!data) return { falha: NAO_EXISTE }
  // O id tal como está na BD (minúsculas): é com ele que se comparam os caminhos no Storage.
  return { contexto: { sessao, supabase, trabalhoId: data.id } }
}

/** Devolve o id do registo do trabalho, criando-o (vazio) se ainda não existir. */
async function obterOuCriarRegisto(
  { supabase, trabalhoId }: Contexto
): Promise<{ id: string } | { erro: ResultadoAcao<never> }> {
  const existente = await supabase.from("registos_trabalho").select("id").eq("trabalho_id", trabalhoId).maybeSingle()
  if (existente.error) return { erro: erroBD(existente.error) }
  if (existente.data) return { id: existente.data.id }

  const novo = await supabase
    .from("registos_trabalho")
    .insert({ trabalho_id: trabalhoId })
    .select("id")
    .single()
  if (novo.error?.code === "23505") {
    // Um colega criou o registo ao mesmo tempo: usar esse.
    const outro = await supabase.from("registos_trabalho").select("id").eq("trabalho_id", trabalhoId).single()
    if (outro.error) return { erro: erroBD(outro.error) }
    return { id: outro.data.id }
  }
  if (novo.error) return { erro: erroBD(novo.error) }
  return { id: novo.data.id }
}

// ---------------------------------------------------------------------
// Estado do trabalho
// ---------------------------------------------------------------------

/**
 * Estados de onde se pode passar para cada estado (os mesmos dos botões).
 * O colaborador só inicia e conclui: agendado → em curso; agendado/em curso
 * → concluído, exatamente o que a BD lhe aceita.
 */
const ORIGENS_ESTADO: Record<EstadoTrabalho, EstadoTrabalho[]> = {
  em_curso: ["agendado"],
  concluido: ["agendado", "em_curso"],
  cancelado: ["agendado", "em_curso"],
  // "Reabrir" (só gerente/chefe).
  agendado: ["concluido", "cancelado"],
}

const MENSAGEM_ESTADO: Record<EstadoTrabalho, string> = {
  em_curso: "Trabalho iniciado.",
  concluido: "Trabalho concluído.",
  cancelado: "Trabalho cancelado.",
  agendado: "Trabalho reaberto.",
}

export async function mudarEstado(id: string, estado: EstadoTrabalho): Promise<ResultadoAcao> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { sessao, supabase, trabalhoId } = preparado.contexto

  const novo = esquemaEstado.safeParse(estado)
  if (!novo.success) return { ok: false, erro: "Estado inválido." }
  // O colaborador só inicia e conclui (a base de dados também o impõe).
  if (!eGerenteOuChefe(sessao.colaborador.perfil) && novo.data !== "em_curso" && novo.data !== "concluido") {
    return SEM_PERMISSAO
  }

  const { data, error } = await supabase
    .from("trabalhos")
    .update({ estado: novo.data })
    .eq("id", trabalhoId)
    .in("estado", ORIGENS_ESTADO[novo.data])
    .select("id")
  if (error) return erroBD(error)

  if (data.length === 0) {
    // O estado mudou entretanto (ex.: um colega já iniciou o trabalho).
    const { data: atual, error: erroAtual } = await supabase
      .from("trabalhos")
      .select("estado")
      .eq("id", trabalhoId)
      .maybeSingle()
    if (erroAtual) return erroBD(erroAtual)
    if (!atual) return NAO_EXISTE
    revalidar(trabalhoId)
    if (atual.estado === novo.data) return { ok: true, mensagem: MENSAGEM_ESTADO[novo.data] }
    return {
      ok: false,
      erro: `Não foi possível: o trabalho está ${NOMES_ESTADO_TRABALHO[atual.estado].toLowerCase()}.`,
    }
  }

  revalidar(trabalhoId)
  return { ok: true, mensagem: MENSAGEM_ESTADO[novo.data] }
}

// ---------------------------------------------------------------------
// Registo do dia (tarefas feitas e notas)
// ---------------------------------------------------------------------

/** O registo como ficou gravado; versao (updated_at) é a base da gravação seguinte. */
export type RegistoGuardado = { versao: string; tarefas_feitas: string | null; notas: string | null }

const CONFLITO_REGISTO: ResultadoAcao<never> = { ok: false, erro: MENSAGEM_CONFLITO_REGISTO }

/**
 * Concorrência otimista: só grava sobre a versão (updated_at) que o
 * formulário carregou. Se um colega gravou entretanto, não grava (senão o
 * texto dele perdia-se) e a pessoa mantém o que escreveu no formulário.
 * versao = null: o registo ainda não existia quando a ficha abriu.
 */
export async function guardarRegisto(
  id: string,
  versao: string | null,
  valores: CamposRegisto
): Promise<ResultadoAcao<RegistoGuardado>> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { supabase, trabalhoId } = preparado.contexto

  const dados = esquemaRegisto.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const base = esquemaVersaoRegisto.safeParse(versao)
  if (!base.success) return CONFLITO_REGISTO

  // O autor (colaborador_id) e o updated_at são definidos pela BD.
  const colunas = "tarefas_feitas, notas, updated_at"
  let gravado: { tarefas_feitas: string | null; notas: string | null; updated_at: string } | null
  if (base.data === null) {
    const { data, error } = await supabase
      .from("registos_trabalho")
      .insert({ trabalho_id: trabalhoId, ...dados.data })
      .select(colunas)
      .single()
    // 23505: um colega criou o registo depois de a ficha abrir.
    if (error?.code === "23505") return CONFLITO_REGISTO
    if (error) return erroBD(error)
    gravado = data
  } else {
    const { data, error } = await supabase
      .from("registos_trabalho")
      .update(dados.data)
      .eq("trabalho_id", trabalhoId)
      .eq("updated_at", base.data)
      .select(colunas)
    if (error) return erroBD(error)
    gravado = data[0] ?? null
  }
  // Nenhuma linha mudou: o registo já não está na versão que a pessoa carregou.
  if (!gravado) return CONFLITO_REGISTO

  revalidar(trabalhoId)
  return {
    ok: true,
    mensagem: "Registo guardado.",
    dados: { versao: gravado.updated_at, tarefas_feitas: gravado.tarefas_feitas, notas: gravado.notas },
  }
}

// ---------------------------------------------------------------------
// Materiais gastos
// ---------------------------------------------------------------------

export async function adicionarMaterial(id: string, valores: CamposMaterial): Promise<ResultadoAcao> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { supabase, trabalhoId } = preparado.contexto

  const dados = esquemaMaterial.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const registo = await obterOuCriarRegisto(preparado.contexto)
  if ("erro" in registo) return registo.erro

  const { error } = await supabase.from("registo_materiais").insert({ registo_id: registo.id, ...dados.data })
  if (error) return erroBD(error)

  revalidar(trabalhoId)
  return { ok: true, mensagem: "Material adicionado." }
}

export async function apagarMaterial(id: string, materialId: string): Promise<ResultadoAcao> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { supabase, trabalhoId } = preparado.contexto

  const material = idObrigatorio.safeParse(materialId)
  if (!material.success) return { ok: false, erro: "O material já não existe." }

  const { data: registo, error: erroRegisto } = await supabase
    .from("registos_trabalho")
    .select("id")
    .eq("trabalho_id", trabalhoId)
    .maybeSingle()
  if (erroRegisto) return erroBD(erroRegisto)
  if (!registo) return { ok: false, erro: "O material já não existe." }

  const { data, error } = await supabase
    .from("registo_materiais")
    .delete()
    .eq("id", material.data)
    .eq("registo_id", registo.id)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return { ok: false, erro: "O material já não existe." }

  revalidar(trabalhoId)
  return { ok: true, mensagem: "Material apagado." }
}

// ---------------------------------------------------------------------
// Fotos (o browser envia o ficheiro para o Storage e depois regista-o aqui)
// ---------------------------------------------------------------------

export async function registarFoto(id: string, dadosFoto: DadosFoto): Promise<ResultadoAcao> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { sessao, supabase, trabalhoId } = preparado.contexto

  const dados = esquemaFoto.safeParse(dadosFoto)
  if (!dados.success || !eCaminhoFoto(trabalhoId, dados.data.caminho)) {
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
    trabalho_id: trabalhoId,
    momento: dados.data.momento,
    caminho: dados.data.caminho,
    largura: dados.data.largura,
    altura: dados.data.altura,
    tamanho_bytes: ficheiro.size && ficheiro.size > 0 ? ficheiro.size : dados.data.tamanho,
    colaborador_id: sessao.colaborador.id,
  })
  // 23505: a mesma foto já ficou registada numa tentativa anterior (falha de rede na resposta).
  if (error && error.code !== "23505") return erroBD(error)

  revalidar(trabalhoId)
  return { ok: true, mensagem: "Foto guardada." }
}

export async function apagarFoto(id: string, fotoId: string): Promise<ResultadoAcao> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { sessao, supabase, trabalhoId } = preparado.contexto

  const fotoValida = idObrigatorio.safeParse(fotoId)
  if (!fotoValida.success) return { ok: false, erro: "A foto já não existe." }

  const { data: foto, error: erroFoto } = await supabase
    .from("fotos")
    .select("id, caminho, colaborador_id")
    .eq("id", fotoValida.data)
    .eq("trabalho_id", trabalhoId)
    .maybeSingle()
  if (erroFoto) return erroBD(erroFoto)
  if (!foto) return { ok: false, erro: "A foto já não existe." }
  // Apaga quem a tirou, o chefe de equipa ou o gerente.
  if (!eGerenteOuChefe(sessao.colaborador.perfil) && foto.colaborador_id !== sessao.colaborador.id) {
    return SEM_PERMISSAO
  }

  const { data, error } = await supabase.from("fotos").delete().eq("id", foto.id).select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return SEM_PERMISSAO

  // Primeiro a linha, depois o ficheiro: nunca fica uma foto a apontar para um ficheiro que já não existe.
  // Só se apaga um ficheiro da pasta deste trabalho; um caminho de outro sítio (que a BD já não
  // aceita) deixaria apagar o ficheiro de outro trabalho: aí sai só a linha.
  if (eCaminhoFoto(trabalhoId, foto.caminho)) {
    const { error: erroRemover } = await supabase.storage.from(BUCKET_FOTOS).remove([foto.caminho])
    if (erroRemover) console.error("Não foi possível apagar o ficheiro da foto:", foto.caminho, erroRemover.message)
  } else {
    console.error("Foto com um caminho fora da pasta do trabalho; o ficheiro não foi apagado:", foto.caminho)
  }

  revalidar(trabalhoId)
  return { ok: true, mensagem: "Foto apagada." }
}

// ---------------------------------------------------------------------
// Assinatura do cliente
// ---------------------------------------------------------------------

export async function guardarAssinatura(id: string, caminho: string, nome: string): Promise<ResultadoAcao> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { supabase, trabalhoId } = preparado.contexto

  const dados = esquemaAssinatura.safeParse({ nome })
  if (!dados.success) return erroValidacao(dados.error)
  if (typeof caminho !== "string" || !eCaminhoAssinatura(trabalhoId, caminho)) {
    return { ok: false, erro: "Os dados da assinatura não são válidos." }
  }

  const { data: ficheiro, error: erroFicheiro } = await supabase.storage.from(BUCKET_FOTOS).info(caminho)
  if (erroFicheiro || !ficheiro) {
    return { ok: false, erro: "A assinatura não chegou ao servidor. Tente de novo." }
  }

  // A data (assinado_em) e o autor (colaborador_id) são definidos pela BD.
  const assinatura = { assinatura_caminho: caminho, assinatura_nome: dados.data.nome }

  const { data: registo, error: erroRegisto } = await supabase
    .from("registos_trabalho")
    .select("id, assinatura_caminho")
    .eq("trabalho_id", trabalhoId)
    .maybeSingle()
  if (erroRegisto) return erroBD(erroRegisto)

  if (!registo) {
    const { error } = await supabase.from("registos_trabalho").insert({ trabalho_id: trabalhoId, ...assinatura })
    if (!error) {
      revalidar(trabalhoId)
      return { ok: true, mensagem: "Assinatura guardada." }
    }
    // 23505: um colega criou o registo entretanto; segue para a atualização.
    if (error.code !== "23505") return erroBD(error)
  } else if (registo.assinatura_caminho) {
    revalidar(trabalhoId)
    return JA_ASSINADO
  }

  // Só grava se ainda não houver assinatura (não substitui a de outra pessoa).
  const { data, error } = await supabase
    .from("registos_trabalho")
    .update(assinatura)
    .eq("trabalho_id", trabalhoId)
    .is("assinatura_caminho", null)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) {
    revalidar(trabalhoId)
    return JA_ASSINADO
  }

  revalidar(trabalhoId)
  return { ok: true, mensagem: "Assinatura guardada." }
}

export async function apagarAssinatura(id: string): Promise<ResultadoAcao> {
  const preparado = await prepararTrabalho(id)
  if ("falha" in preparado) return preparado.falha
  const { sessao, supabase, trabalhoId } = preparado.contexto
  if (!eGerenteOuChefe(sessao.colaborador.perfil)) return SEM_PERMISSAO

  const { data: registo, error: erroRegisto } = await supabase
    .from("registos_trabalho")
    .select("id, assinatura_caminho")
    .eq("trabalho_id", trabalhoId)
    .maybeSingle()
  if (erroRegisto) return erroBD(erroRegisto)
  if (!registo?.assinatura_caminho) {
    revalidar(trabalhoId)
    return { ok: false, erro: "Este trabalho já não tem assinatura." }
  }

  // A BD limpa o nome e a data da assinatura com a imagem.
  const { data, error } = await supabase
    .from("registos_trabalho")
    .update({ assinatura_caminho: null })
    .eq("id", registo.id)
    .eq("assinatura_caminho", registo.assinatura_caminho)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return SEM_PERMISSAO

  // Tal como nas fotos: só se apaga um ficheiro da pasta deste trabalho.
  if (eCaminhoAssinatura(trabalhoId, registo.assinatura_caminho)) {
    const { error: erroRemover } = await supabase.storage.from(BUCKET_FOTOS).remove([registo.assinatura_caminho])
    if (erroRemover) {
      console.error("Não foi possível apagar o ficheiro da assinatura:", registo.assinatura_caminho, erroRemover.message)
    }
  } else {
    console.error(
      "Assinatura com um caminho fora da pasta do trabalho; o ficheiro não foi apagado:",
      registo.assinatura_caminho
    )
  }

  revalidar(trabalhoId)
  return { ok: true, mensagem: "Assinatura apagada." }
}
