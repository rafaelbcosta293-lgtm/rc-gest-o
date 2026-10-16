"use server"

import { revalidatePath } from "next/cache"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao, type Sessao } from "@/lib/auth"
import { formatarData, hojeEmLisboa } from "@/lib/formatar"
import { eGerente, eGerenteOuChefe } from "@/lib/perfis"
import { ESTADOS_CHEFE, NOMES_ESTADO_EQUIPAMENTO } from "@/lib/recursos"
import type { TablesUpdate } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaEquipamento,
  esquemaManutencao,
  esquemaMudarEstado,
  eTipoComPrazo,
  MENSAGEM_MATRICULA_REPETIDA,
  PRAZO_DA_MANUTENCAO,
  type CamposEquipamento,
  type CamposManutencao,
  type CamposMudarEstado,
  type DadosEquipamento,
  type DadosManutencao,
  type TipoComPrazo,
} from "@/lib/validacao/equipamentos"

type Supabase = Awaited<ReturnType<typeof createClient>>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O equipamento não existe ou não tem acesso a ele.",
}

const MANUTENCAO_NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "A manutenção já não existe. Atualize a página.",
}

const SO_GERENTE: ResultadoAcao<never> = {
  ok: false,
  erro: "Só o gerente pode criar, editar e apagar equipamentos e manutenções.",
}

const FORA_DA_EQUIPA: ResultadoAcao<never> = {
  ok: false,
  erro: "Só pode mudar o estado dos equipamentos da sua equipa ou sem equipa.",
}

/** Sessão do gerente; null nos outros casos. */
async function sessaoGerente(): Promise<Sessao | null> {
  const sessao = await obterSessao()
  return sessao && eGerente(sessao.colaborador.perfil) ? sessao : null
}

/** A lista e as fichas dos equipamentos, e o Início (alertas). */
function revalidarEquipamentos() {
  revalidatePath("/recursos", "layout")
  revalidatePath("/")
}

function erroCampo(campo: string, mensagem: string): ResultadoAcao<never> {
  return { ok: false, erro: mensagem, campos: { [campo]: [mensagem] } }
}

/** Mensagens das regras da BD ao gravar um equipamento. */
function erroGravarEquipamento(erro: Parameters<typeof erroBD>[0]): ResultadoAcao<never> {
  // A única regra de unicidade (além do id) é a matrícula.
  if (erro?.code === "23505") return erroCampo("matricula", MENSAGEM_MATRICULA_REPETIDA)
  return erroBD(erro, { emUso: "A equipa ou a pessoa escolhida já não existe. Atualize a página." })
}

/**
 * A equipa tem de estar ativa e a pessoa ser um colaborador ativo (ou serem
 * as que o equipamento já tinha, ao editar).
 */
async function validarAtribuicao(
  supabase: Supabase,
  dados: DadosEquipamento,
  atual?: { equipa_id: string | null; colaborador_id: string | null }
): Promise<ResultadoAcao<never> | null> {
  if (dados.equipa_id && dados.equipa_id !== atual?.equipa_id) {
    const { data, error } = await supabase.from("equipas").select("ativa").eq("id", dados.equipa_id).maybeSingle()
    if (error) return erroBD(error)
    if (!data?.ativa) return erroCampo("equipa_id", "Escolha uma equipa ativa.")
  }
  if (dados.colaborador_id && dados.colaborador_id !== atual?.colaborador_id) {
    const { data, error } = await supabase
      .from("colaboradores")
      .select("ativo")
      .eq("id", dados.colaborador_id)
      .maybeSingle()
    if (error) return erroBD(error)
    if (!data?.ativo) return erroCampo("colaborador_id", "Escolha um colaborador ativo.")
  }
  return null
}

function colunasEquipamento(dados: DadosEquipamento) {
  return {
    nome: dados.nome,
    tipo: dados.tipo,
    marca: dados.marca,
    modelo: dados.modelo,
    numero_serie: dados.numero_serie,
    matricula: dados.matricula,
    equipa_id: dados.equipa_id,
    colaborador_id: dados.colaborador_id,
    data_aquisicao: dados.data_aquisicao,
    proxima_revisao: dados.proxima_revisao,
    seguro_ate: dados.seguro_ate,
    ipo_ate: dados.ipo_ate,
    notas: dados.notas,
  }
}

// ---------------------------------------------------------------------
// Equipamentos (gerente)
// ---------------------------------------------------------------------

export async function criarEquipamento(valores: CamposEquipamento): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SO_GERENTE

  const dados = esquemaEquipamento.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const problema = await validarAtribuicao(supabase, dados.data)
  if (problema) return problema

  // Um equipamento novo está sempre operacional.
  const { data, error } = await supabase
    .from("equipamentos")
    .insert({ ...colunasEquipamento(dados.data), estado: "operacional" })
    .select("id")
    .single()
  if (error) return erroGravarEquipamento(error)

  revalidarEquipamentos()
  return { ok: true, mensagem: "Equipamento criado.", redirecionar: `/recursos/equipamentos/${data.id}` }
}

/**
 * Grava só sobre a versão (updated_at) que o formulário abriu: o chefe pode
 * ter mudado o estado ou acrescentado uma nota entretanto, e o formulário
 * traz o estado e as notas antigos.
 */
export async function atualizarEquipamento(
  id: string,
  versao: string,
  valores: CamposEquipamento
): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SO_GERENTE

  const equipamentoId = idObrigatorio.safeParse(id)
  if (!equipamentoId.success || typeof versao !== "string" || !versao) return NAO_EXISTE
  const dados = esquemaEquipamento.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("equipamentos")
    .select("id, equipa_id, colaborador_id")
    .eq("id", equipamentoId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE

  const problema = await validarAtribuicao(supabase, dados.data, atual)
  if (problema) return problema

  const { data, error } = await supabase
    .from("equipamentos")
    .update({ ...colunasEquipamento(dados.data), estado: dados.data.estado })
    .eq("id", atual.id)
    .eq("updated_at", versao)
    .select("id")
  if (error) return erroGravarEquipamento(error)
  if (data.length === 0) {
    revalidarEquipamentos()
    return {
      ok: false,
      erro: "O equipamento foi alterado entretanto (por exemplo, o chefe mudou o estado ou acrescentou uma nota). A página foi atualizada: reveja e guarde de novo.",
    }
  }

  revalidarEquipamentos()
  return { ok: true, mensagem: "Equipamento guardado.", redirecionar: `/recursos/equipamentos/${atual.id}` }
}

/** Apaga o equipamento e as suas manutenções (a BD apaga-as em cascata). */
export async function apagarEquipamento(id: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SO_GERENTE

  const equipamentoId = idObrigatorio.safeParse(id)
  if (!equipamentoId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase.from("equipamentos").delete().eq("id", equipamentoId.data).select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarEquipamentos()
  return { ok: true, mensagem: "Equipamento apagado.", redirecionar: "/recursos" }
}

// ---------------------------------------------------------------------
// Mudar o estado (gerente; chefe nos da sua equipa ou sem equipa)
// ---------------------------------------------------------------------

/**
 * O chefe muda o estado (operacional, avariado, em reparação) dos
 * equipamentos da equipa que chefia ou sem equipa; o gerente também abate.
 * A nota fica acrescentada às notas do equipamento, com o dia e quem a
 * escreveu.
 */
export async function mudarEstadoEquipamento(id: string, valores: CamposMudarEstado): Promise<ResultadoAcao> {
  const sessao = await obterSessao()
  if (!sessao || !eGerenteOuChefe(sessao.colaborador.perfil)) return SEM_PERMISSAO
  const gerente = eGerente(sessao.colaborador.perfil)

  const equipamentoId = idObrigatorio.safeParse(id)
  if (!equipamentoId.success) return NAO_EXISTE
  const dados = esquemaMudarEstado.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { estado, nota } = dados.data

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("equipamentos")
    .select("id, estado, notas, equipa_id, updated_at")
    .eq("id", equipamentoId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE

  if (!gerente) {
    if (atual.estado === "abatido" || !ESTADOS_CHEFE.includes(estado)) {
      return erroCampo("estado", "Só o gerente pode abater um equipamento (ou voltar a pô-lo ao serviço).")
    }
    if (atual.equipa_id) {
      const { data: chefiada, error } = await supabase
        .from("equipas")
        .select("id")
        .eq("id", atual.equipa_id)
        .eq("chefe_id", sessao.colaborador.id)
        .maybeSingle()
      if (error) return erroBD(error)
      if (!chefiada) return FORA_DA_EQUIPA
    }
  }

  const mudou = estado !== atual.estado
  if (!mudou && !nota) return erroCampo("nota", "Escolha outro estado ou escreva uma nota.")

  const alteracoes: TablesUpdate<"equipamentos"> = { estado }
  if (nota) {
    const linha = `${formatarData(hojeEmLisboa())}, ${sessao.colaborador.nome}${mudou ? ` (${NOMES_ESTADO_EQUIPAMENTO[estado]})` : ""}: ${nota}`
    alteracoes.notas = atual.notas?.trim() ? `${atual.notas.trimEnd()}\n${linha}` : linha
  }
  // Só se grava sobre a versão lida (não se perdem notas escritas entretanto por outra pessoa).
  const { data, error } = await supabase
    .from("equipamentos")
    .update(alteracoes)
    .eq("id", atual.id)
    .eq("updated_at", atual.updated_at)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) {
    revalidarEquipamentos()
    return { ok: false, erro: "O equipamento foi alterado entretanto. A página foi atualizada: tente de novo." }
  }

  revalidarEquipamentos()
  return {
    ok: true,
    mensagem: mudou ? `Estado mudado para ${NOMES_ESTADO_EQUIPAMENTO[estado]}.` : "Nota acrescentada.",
  }
}

// ---------------------------------------------------------------------
// Manutenções (gerente)
// ---------------------------------------------------------------------

/** Aviso quando a manutenção ficou gravada mas a data do equipamento não. */
export type ResultadoManutencao = ResultadoAcao<{ aviso: boolean }>

const DATA_ATUALIZADA: Record<TipoComPrazo, (data: string) => string> = {
  revisao: (data) => `A próxima revisão passou para ${data}.`,
  ipo: (data) => `A IPO ficou válida até ${data}.`,
  seguro: (data) => `O seguro ficou válido até ${data}.`,
}

const DATA_NAO_ATUALIZADA: Record<TipoComPrazo, string> = {
  revisao: "a data da próxima revisão",
  ipo: "a validade da IPO",
  seguro: "a validade do seguro",
}

type Preparado =
  | { falha: ResultadoAcao<never> }
  | { supabase: Supabase; equipamento: { id: string; tipo: string }; dados: DadosManutencao }

/** Sessão de gerente, ids e dados válidos e o equipamento (visível). */
async function prepararManutencao(equipamentoId: string, valores: CamposManutencao): Promise<Preparado> {
  if (!(await sessaoGerente())) return { falha: SO_GERENTE }
  const idValido = idObrigatorio.safeParse(equipamentoId)
  if (!idValido.success) return { falha: NAO_EXISTE }
  const dados = esquemaManutencao.safeParse(valores)
  if (!dados.success) return { falha: erroValidacao(dados.error) }

  const supabase = await createClient()
  const { data: equipamento, error } = await supabase
    .from("equipamentos")
    .select("id, tipo")
    .eq("id", idValido.data)
    .maybeSingle()
  if (error) return { falha: erroBD(error) }
  if (!equipamento) return { falha: NAO_EXISTE }
  // A IPO só existe nas viaturas (o formulário nem mostra a data nos outros equipamentos).
  const semPrazo = dados.data.tipo === "ipo" && equipamento.tipo !== "viatura"
  return { supabase, equipamento, dados: semPrazo ? { ...dados.data, nova_data: null } : dados.data }
}

/**
 * Depois de gravar a manutenção: numa revisão, IPO ou seguro com nova data,
 * atualiza também essa data no equipamento (o alerta desaparece).
 */
async function atualizarPrazo(
  supabase: Supabase,
  equipamentoId: string,
  dados: DadosManutencao,
  mensagem: string
): Promise<ResultadoManutencao> {
  const tipo = dados.tipo
  if (!dados.nova_data || !eTipoComPrazo(tipo)) return { ok: true, mensagem, dados: { aviso: false } }

  const alteracoes: TablesUpdate<"equipamentos"> = {}
  alteracoes[PRAZO_DA_MANUTENCAO[tipo]] = dados.nova_data
  const { data, error } = await supabase.from("equipamentos").update(alteracoes).eq("id", equipamentoId).select("id")
  if (error || data.length === 0) {
    if (error) console.error("Erro ao atualizar a data do equipamento:", error.code, error.message)
    return {
      ok: true,
      mensagem: `${mensagem} Mas não foi possível atualizar ${DATA_NAO_ATUALIZADA[tipo]} no equipamento: edite o equipamento para a corrigir.`,
      dados: { aviso: true },
    }
  }
  return { ok: true, mensagem: `${mensagem} ${DATA_ATUALIZADA[tipo](formatarData(dados.nova_data))}`, dados: { aviso: false } }
}

export async function criarManutencao(equipamentoId: string, valores: CamposManutencao): Promise<ResultadoManutencao> {
  const preparado = await prepararManutencao(equipamentoId, valores)
  if ("falha" in preparado) return preparado.falha
  const { supabase, equipamento, dados } = preparado

  // Quem regista (colaborador_id) é definido pela BD.
  const { error } = await supabase.from("manutencoes_equipamento").insert({
    equipamento_id: equipamento.id,
    data: dados.data,
    tipo: dados.tipo,
    descricao: dados.descricao,
    custo: dados.custo,
    contador: dados.contador,
  })
  if (error) return erroBD(error, { emUso: "O equipamento já não existe. Atualize a página." })

  const resultado = await atualizarPrazo(supabase, equipamento.id, dados, "Manutenção registada.")
  revalidarEquipamentos()
  return resultado
}

export async function atualizarManutencao(
  equipamentoId: string,
  manutencaoId: string,
  valores: CamposManutencao
): Promise<ResultadoManutencao> {
  const preparado = await prepararManutencao(equipamentoId, valores)
  if ("falha" in preparado) return preparado.falha
  const { supabase, equipamento, dados } = preparado
  const idValido = idObrigatorio.safeParse(manutencaoId)
  if (!idValido.success) return MANUTENCAO_NAO_EXISTE

  const { data, error } = await supabase
    .from("manutencoes_equipamento")
    .update({
      data: dados.data,
      tipo: dados.tipo,
      descricao: dados.descricao,
      custo: dados.custo,
      contador: dados.contador,
    })
    .eq("id", idValido.data)
    .eq("equipamento_id", equipamento.id)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return MANUTENCAO_NAO_EXISTE

  const resultado = await atualizarPrazo(supabase, equipamento.id, dados, "Manutenção guardada.")
  revalidarEquipamentos()
  return resultado
}

export async function apagarManutencao(equipamentoId: string, manutencaoId: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SO_GERENTE
  const equipamentoValido = idObrigatorio.safeParse(equipamentoId)
  const manutencaoValida = idObrigatorio.safeParse(manutencaoId)
  if (!equipamentoValido.success || !manutencaoValida.success) return MANUTENCAO_NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("manutencoes_equipamento")
    .delete()
    .eq("id", manutencaoValida.data)
    .eq("equipamento_id", equipamentoValido.data)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return MANUTENCAO_NAO_EXISTE

  revalidarEquipamentos()
  return { ok: true, mensagem: "Manutenção apagada." }
}
