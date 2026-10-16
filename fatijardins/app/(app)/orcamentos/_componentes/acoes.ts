"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao, type Sessao } from "@/lib/auth"
import { formatarData, hojeEmLisboa } from "@/lib/formatar"
import { ESTADOS_ORCAMENTO, NOMES_ESTADO_ORCAMENTO, podeMudarEstado, type EstadoOrcamento } from "@/lib/orcamentos"
import { eGerente, eGerenteOuChefe } from "@/lib/perfis"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { gravarOrdens, lugaresNaOrdem } from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaConverter,
  esquemaLinha,
  esquemaOrcamento,
  type CamposConverter,
  type CamposLinha,
  type CamposOrcamento,
  type DadosOrcamento,
} from "@/lib/validacao/orcamentos"

type Supabase = Awaited<ReturnType<typeof createClient>>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O orçamento não existe ou não tem acesso a ele.",
}

const LINHA_NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "A linha já não existe. Atualize a página.",
}

/**
 * O orçamento deixou de estar em rascunho (ex.: o gerente enviou-o enquanto a
 * página estava aberta): atualiza a página e explica, sem pedir ao chefe uma
 * ação que só o gerente pode fazer.
 */
function soRascunho(): ResultadoAcao<never> {
  revalidarOrcamentos()
  return {
    ok: false,
    erro: "Este orçamento já não está em rascunho (foi enviado entretanto) e não pode ser alterado. A página foi atualizada.",
  }
}

const ALTERADO_ENTRETANTO: ResultadoAcao<never> = {
  ok: false,
  erro: "O orçamento foi alterado entretanto. Atualize a página e tente de novo.",
}

const SO_GERENTE: ResultadoAcao<never> = {
  ok: false,
  erro: "Só o gerente pode mudar o estado do orçamento ou convertê-lo em trabalho.",
}

const MENSAGEM_ESTADO: Record<EstadoOrcamento, string> = {
  rascunho: "O orçamento voltou a rascunho.",
  enviado: "Orçamento marcado como enviado.",
  aceite: "Orçamento marcado como aceite.",
  recusado: "Orçamento marcado como recusado.",
}

/** Gerente ou chefe de equipa (quem faz orçamentos); null nos outros casos. */
async function sessaoGestor(): Promise<Sessao | null> {
  const sessao = await obterSessao()
  return sessao && eGerenteOuChefe(sessao.colaborador.perfil) ? sessao : null
}

/** A lista, as fichas dos orçamentos (e das visitas, que os mostram), o histórico do cliente e o Início. */
function revalidarOrcamentos() {
  revalidatePath("/orcamentos", "layout")
  revalidatePath("/clientes/[id]", "page")
  revalidatePath("/")
}

function erroCampo(campo: keyof CamposOrcamento, mensagem: string): ResultadoAcao<never> {
  return { ok: false, erro: mensagem, campos: { [campo]: [mensagem] } }
}

/**
 * O local tem de pertencer ao cliente escolhido (e estar ativo, salvo se já
 * era o do orçamento) e a visita, se houver, tem de ser desse local.
 */
async function validarLocalEVisita(
  supabase: Supabase,
  dados: DadosOrcamento,
  localAtual?: string
): Promise<ResultadoAcao<never> | null> {
  const [localR, visitaR] = await Promise.all([
    supabase.from("locais").select("id, cliente_id, ativo").eq("id", dados.local_id).maybeSingle(),
    dados.visita_id
      ? supabase.from("visitas").select("id, local_id").eq("id", dados.visita_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (localR.error) return erroBD(localR.error)
  if (visitaR.error) return erroBD(visitaR.error)
  const local = localR.data
  if (!local || local.cliente_id !== dados.cliente_id) return erroCampo("local_id", "Escolha um local deste cliente.")
  if (!local.ativo && local.id !== localAtual) return erroCampo("local_id", "Este local está desativado. Escolha outro.")
  if (dados.visita_id) {
    if (!visitaR.data) return { ok: false, erro: "A visita já não existe. Desligue o orçamento da visita." }
    if (visitaR.data.local_id !== dados.local_id) {
      return erroCampo("local_id", "A visita foi feita noutro local. Escolha esse local ou desligue o orçamento da visita.")
    }
  }
  return null
}

/** Só as colunas que a BD deixa escrever (o número, o cliente e os totais são dela). */
function colunasOrcamento(dados: DadosOrcamento) {
  return {
    local_id: dados.local_id,
    visita_id: dados.visita_id,
    titulo: dados.titulo,
    descricao: dados.descricao,
    data: dados.data,
    validade: dados.validade,
    condicoes: dados.condicoes,
    notas_internas: dados.notas_internas,
  }
}

// ---------------------------------------------------------------------
// Orçamento: criar, editar, apagar e mudar de estado
// ---------------------------------------------------------------------

export async function criarOrcamento(valores: CamposOrcamento): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const dados = esquemaOrcamento.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const problema = await validarLocalEVisita(supabase, dados.data)
  if (problema) return problema

  // O ano, o número e o cliente são preenchidos pelos triggers da BD.
  const linha = colunasOrcamento(dados.data) as TablesInsert<"orcamentos">
  const { data, error } = await supabase.from("orcamentos").insert(linha).select("id").single()
  if (error) return erroBD(error, { emUso: "O local ou a visita já não existem. Atualize a página." })

  revalidarOrcamentos()
  return { ok: true, mensagem: "Orçamento criado. Acrescente as linhas.", redirecionar: `/orcamentos/${data.id}` }
}

export async function atualizarOrcamento(id: string, valores: CamposOrcamento): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const orcamentoId = idObrigatorio.safeParse(id)
  if (!orcamentoId.success) return NAO_EXISTE
  const dados = esquemaOrcamento.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("orcamentos")
    .select("id, estado, local_id")
    .eq("id", orcamentoId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE
  if (atual.estado !== "rascunho") return soRascunho()

  const problema = await validarLocalEVisita(supabase, dados.data, atual.local_id)
  if (problema) return problema

  const alteracoes: TablesUpdate<"orcamentos"> = colunasOrcamento(dados.data)
  const { data: linhas, error } = await supabase
    .from("orcamentos")
    .update(alteracoes)
    .eq("id", atual.id)
    .eq("estado", "rascunho")
    .select("id")
  // A BD recusa mudar a data para outro ano (o número é desse ano) com uma mensagem clara.
  if (error) return erroBD(error, { emUso: "O local ou a visita já não existem. Atualize a página." })
  if (linhas.length === 0) return soRascunho()

  revalidarOrcamentos()
  return { ok: true, mensagem: "Orçamento guardado." }
}

/** Gerente: rascunhos e recusados. Chefe: os rascunhos que criou (a RLS confirma). */
export async function apagarOrcamento(id: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const orcamentoId = idObrigatorio.safeParse(id)
  if (!orcamentoId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("orcamentos")
    .select("id, estado, criado_por")
    .eq("id", orcamentoId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE
  if (eGerente(sessao.colaborador.perfil)) {
    if (atual.estado !== "rascunho" && atual.estado !== "recusado") {
      return { ok: false, erro: "Só se apagam orçamentos em rascunho ou recusados." }
    }
  } else if (atual.estado !== "rascunho" || atual.criado_por !== sessao.colaborador.id) {
    return { ok: false, erro: "Só pode apagar os rascunhos que criou." }
  }

  const { data: apagados, error } = await supabase.from("orcamentos").delete().eq("id", atual.id).select("id")
  if (error) return erroBD(error)
  if (apagados.length === 0) return ALTERADO_ENTRETANTO

  revalidarOrcamentos()
  return { ok: true, mensagem: "Orçamento apagado.", redirecionar: "/orcamentos" }
}

/** Muda o estado (só o gerente). A BD recusa enviar um orçamento sem linhas. */
export async function mudarEstadoOrcamento(id: string, estado: EstadoOrcamento): Promise<ResultadoAcao> {
  const sessao = await obterSessao()
  if (!sessao || !eGerenteOuChefe(sessao.colaborador.perfil)) return SEM_PERMISSAO
  if (!eGerente(sessao.colaborador.perfil)) return SO_GERENTE

  const pedido = z.object({ id: idObrigatorio, estado: z.enum(ESTADOS_ORCAMENTO) }).safeParse({ id, estado })
  if (!pedido.success) return NAO_EXISTE
  const novo = pedido.data.estado

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("orcamentos")
    .select("id, estado, trabalho_id, validade")
    .eq("id", pedido.data.id)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE
  if (atual.estado === novo) return { ok: true, mensagem: "O orçamento já estava neste estado." }
  // Um rascunho antigo seria enviado já fora de validade.
  if (atual.estado === "rascunho" && novo === "enviado" && atual.validade < hojeEmLisboa()) {
    return {
      ok: false,
      erro: `A validade (${formatarData(atual.validade)}) já passou: atualize a data e a validade antes de enviar.`,
    }
  }
  if (!podeMudarEstado(atual.estado, novo, atual.trabalho_id !== null)) {
    revalidarOrcamentos()
    return {
      ok: false,
      erro:
        atual.estado === "aceite" && atual.trabalho_id
          ? "Este orçamento já foi convertido em trabalho e não pode mudar de estado."
          : `Não é possível passar o orçamento de ${NOMES_ESTADO_ORCAMENTO[atual.estado].toLowerCase()} para ${NOMES_ESTADO_ORCAMENTO[novo].toLowerCase()}.`,
    }
  }

  const { data: linhas, error } = await supabase
    .from("orcamentos")
    .update({ estado: novo })
    .eq("id", atual.id)
    .eq("estado", atual.estado)
    .select("id")
  if (error) return erroBD(error)
  if (linhas.length === 0) {
    revalidarOrcamentos()
    return ALTERADO_ENTRETANTO
  }

  revalidarOrcamentos()
  return { ok: true, mensagem: MENSAGEM_ESTADO[novo] }
}

// ---------------------------------------------------------------------
// Linhas (só com o orçamento em rascunho)
// ---------------------------------------------------------------------

/** Confirma que o orçamento existe e está em rascunho; devolve o erro a mostrar, ou null. */
async function exigirRascunho(supabase: Supabase, orcamentoId: string): Promise<ResultadoAcao<never> | null> {
  const { data, error } = await supabase.from("orcamentos").select("estado").eq("id", orcamentoId).maybeSingle()
  if (error) return erroBD(error)
  if (!data) return NAO_EXISTE
  return data.estado === "rascunho" ? null : soRascunho()
}

/** A RLS recusa (42501) mexer nas linhas de um orçamento que deixou de estar em rascunho. */
function erroLinha(erro: PostgrestError): ResultadoAcao<never> {
  if (erro.code === "42501") {
    console.error("Erro da base de dados:", erro.code, erro.message)
    return soRascunho()
  }
  return erroBD(erro, { emUso: "O orçamento já não existe. Atualize a página." })
}

const idsLinha = z.object({ orcamentoId: idObrigatorio, linhaId: idObrigatorio })

export async function criarLinha(orcamentoId: string, valores: CamposLinha): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const id = idObrigatorio.safeParse(orcamentoId)
  if (!id.success) return NAO_EXISTE
  const dados = esquemaLinha.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const problema = await exigirRascunho(supabase, id.data)
  if (problema) return problema

  // Fica no fim (a ordem conta dentro de cada tipo).
  const { data: ultima, error: erroOrdem } = await supabase
    .from("orcamento_linhas")
    .select("ordem")
    .eq("orcamento_id", id.data)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (erroOrdem) return erroBD(erroOrdem)

  const linha: TablesInsert<"orcamento_linhas"> = {
    orcamento_id: id.data,
    ordem: (ultima?.ordem ?? 0) + 1,
    ...dados.data,
  }
  const { error } = await supabase.from("orcamento_linhas").insert(linha)
  if (error) return erroLinha(error)

  revalidarOrcamentos()
  return { ok: true, mensagem: "Linha acrescentada." }
}

export async function atualizarLinha(orcamentoId: string, linhaId: string, valores: CamposLinha): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const ids = idsLinha.safeParse({ orcamentoId, linhaId })
  if (!ids.success) return LINHA_NAO_EXISTE
  const dados = esquemaLinha.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const problema = await exigirRascunho(supabase, ids.data.orcamentoId)
  if (problema) return problema

  const alteracoes: TablesUpdate<"orcamento_linhas"> = dados.data
  const { data, error } = await supabase
    .from("orcamento_linhas")
    .update(alteracoes)
    .eq("id", ids.data.linhaId)
    .eq("orcamento_id", ids.data.orcamentoId)
    .select("id")
  if (error) return erroLinha(error)
  if (data.length === 0) return LINHA_NAO_EXISTE

  revalidarOrcamentos()
  return { ok: true, mensagem: "Linha guardada." }
}

export async function apagarLinha(orcamentoId: string, linhaId: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const ids = idsLinha.safeParse({ orcamentoId, linhaId })
  if (!ids.success) return LINHA_NAO_EXISTE

  const supabase = await createClient()
  const problema = await exigirRascunho(supabase, ids.data.orcamentoId)
  if (problema) return problema

  const { data, error } = await supabase
    .from("orcamento_linhas")
    .delete()
    .eq("id", ids.data.linhaId)
    .eq("orcamento_id", ids.data.orcamentoId)
    .select("id")
  if (error) return erroLinha(error)
  if (data.length === 0) return LINHA_NAO_EXISTE

  revalidarOrcamentos()
  return { ok: true, mensagem: "Linha apagada." }
}

/**
 * Sobe ou desce uma linha dentro do seu tipo (as linhas aparecem agrupadas
 * por tipo): troca de lugar com a anterior/seguinte do mesmo tipo e volta a
 * numerar a ordem de todas (1..n), gravando só as que mudaram.
 */
export async function moverLinha(orcamentoId: string, linhaId: string, direcao: "cima" | "baixo"): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const pedido = idsLinha.extend({ direcao: z.enum(["cima", "baixo"]) }).safeParse({ orcamentoId, linhaId, direcao })
  if (!pedido.success) return LINHA_NAO_EXISTE

  const supabase = await createClient()
  const problema = await exigirRascunho(supabase, pedido.data.orcamentoId)
  if (problema) return problema

  const { data: linhas, error: erroLer } = await supabase
    .from("orcamento_linhas")
    .select("id, tipo, ordem")
    .eq("orcamento_id", pedido.data.orcamentoId)
    .order("ordem")
    .order("created_at")
  if (erroLer) return erroBD(erroLer)

  const i = linhas.findIndex((linha) => linha.id === pedido.data.linhaId)
  if (i === -1) return LINHA_NAO_EXISTE
  const tipo = linhas[i].tipo
  const j =
    pedido.data.direcao === "cima"
      ? linhas.findLastIndex((linha, k) => k < i && linha.tipo === tipo)
      : linhas.findIndex((linha, k) => k > i && linha.tipo === tipo)
  // Já é a primeira (ou a última) do seu tipo.
  if (j === -1) return { ok: true }

  const nova = [...linhas]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  const mudancas = nova
    .map((linha, k) => ({ id: linha.id, ordem: k + 1, antes: linha.ordem }))
    .filter((linha) => linha.ordem !== linha.antes)
  const resultados = await Promise.all(
    mudancas.map((linha) =>
      supabase
        .from("orcamento_linhas")
        .update({ ordem: linha.ordem })
        .eq("id", linha.id)
        .eq("orcamento_id", pedido.data.orcamentoId)
    )
  )
  const falha = resultados.find((resultado) => resultado.error)
  revalidarOrcamentos()
  if (falha?.error) return erroLinha(falha.error)
  return { ok: true }
}

// ---------------------------------------------------------------------
// Converter o orçamento aceite em trabalho (só o gerente)
// ---------------------------------------------------------------------

/**
 * Cria o trabalho com a RPC converter_orcamento, no lugar da ordem de
 * passagem que um trabalho novo teria nesse dia/equipa (lugaresNaOrdem, como
 * em criarTrabalho), e empurra os seguintes.
 */
export async function converterOrcamento(id: string, valores: CamposConverter): Promise<ResultadoAcao> {
  const sessao = await obterSessao()
  if (!sessao || !eGerenteOuChefe(sessao.colaborador.perfil)) return SEM_PERMISSAO
  if (!eGerente(sessao.colaborador.perfil)) return SO_GERENTE

  const orcamentoId = idObrigatorio.safeParse(id)
  if (!orcamentoId.success) return NAO_EXISTE
  const dados = esquemaConverter.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const trabalho = dados.data

  const supabase = await createClient()
  const [orcamentoR, equipaR] = await Promise.all([
    supabase.from("orcamentos").select("id, estado, trabalho_id").eq("id", orcamentoId.data).maybeSingle(),
    trabalho.equipa_id
      ? supabase.from("equipas").select("id, ativa").eq("id", trabalho.equipa_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (orcamentoR.error) return erroBD(orcamentoR.error)
  if (equipaR.error) return erroBD(equipaR.error)
  const orcamento = orcamentoR.data
  if (!orcamento) return NAO_EXISTE
  if (orcamento.trabalho_id) {
    revalidarOrcamentos()
    return { ok: false, erro: "Este orçamento já foi convertido em trabalho." }
  }
  if (orcamento.estado !== "aceite") return { ok: false, erro: "Só um orçamento aceite pode ser convertido em trabalho." }
  if (trabalho.equipa_id && !equipaR.data?.ativa) {
    const mensagem = "Escolha uma equipa ativa (ou deixe por atribuir)."
    return { ok: false, erro: mensagem, campos: { equipa_id: [mensagem] } }
  }

  const lugares = await lugaresNaOrdem(supabase, trabalho.equipa_id, [
    { data: trabalho.data, hora: trabalho.hora_inicio },
  ])
  const lugar = lugares?.get(trabalho.data)
  if (!lugar) return erroBD(null)

  const { data: trabalhoId, error } = await supabase.rpc("converter_orcamento", {
    p_orcamento_id: orcamento.id,
    p_data: trabalho.data,
    p_equipa_id: trabalho.equipa_id ?? undefined,
    p_tipo: trabalho.tipo,
    p_hora: trabalho.hora_inicio ?? undefined,
    p_ordem: lugar.ordem,
  })
  if (error) return erroBD(error, { emUso: "A equipa já não existe. Atualize a página." })
  await gravarOrdens(supabase, lugar.empurrados)

  revalidarOrcamentos()
  revalidatePath("/agenda", "layout")
  revalidatePath("/trabalhos/[id]", "layout")
  return { ok: true, mensagem: "Trabalho criado a partir do orçamento.", redirecionar: `/trabalhos/${trabalhoId}` }
}
