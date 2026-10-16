"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao } from "@/lib/auth"
import { hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import { formatarQuantidade, type TipoMovimentoStock } from "@/lib/recursos"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaAcerto,
  esquemaConsumivel,
  esquemaEditarAcerto,
  esquemaEntrada,
  esquemaSaida,
  type CamposAcerto,
  type CamposConsumivel,
  type CamposEditarAcerto,
  type CamposEntrada,
  type CamposSaida,
  type DadosConsumivel,
} from "@/lib/validacao/consumiveis"

type Supabase = Awaited<ReturnType<typeof createClient>>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O consumível não existe ou não tem acesso a ele.",
}

const MOVIMENTO_NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O movimento já não existe. Atualize a página.",
}

const DO_MATERIAL: ResultadoAcao<never> = {
  ok: false,
  erro: "Esta saída vem dos materiais gastos num trabalho: altere ou apague o material na ficha do trabalho.",
}

const NOME_REPETIDO = "Já existe um consumível com este nome."
const COM_MOVIMENTOS = "Tem movimentos de stock: desative-o em vez de o apagar."
const UNIDADE_BLOQUEADA =
  "Já há movimentos de stock nesta unidade, por isso não a pode mudar. Se a unidade está errada, crie um consumível novo e desative este."
const TRABALHO_NAO_EXISTE = "O trabalho escolhido já não existe. Escolha outro."
const JA_NAO_EXISTE = { emUso: "O consumível ou o trabalho já não existem. Atualize a página." }

/** Só o gerente gere o catálogo e o stock (a RLS também o garante). */
async function sessaoGerente(): Promise<boolean> {
  const sessao = await obterSessao()
  return eGerente(sessao?.colaborador.perfil)
}

/** A lista e as fichas dos consumíveis, a escolha de materiais nos trabalhos e o Início (alertas). */
function revalidarConsumiveis() {
  revalidatePath("/recursos/consumiveis", "layout")
  revalidatePath("/trabalhos/[id]", "page")
  revalidatePath("/")
}

/** Depois de um movimento: a lista, as fichas e o Início (alertas de stock baixo). */
function revalidarStock() {
  revalidatePath("/recursos/consumiveis", "layout")
  revalidatePath("/")
}

/** O nome repetido também aparece no próprio campo. */
function erroGravarConsumivel(erro: PostgrestError): ResultadoAcao<never> {
  if (erro.code === "23505") return { ok: false, erro: NOME_REPETIDO, campos: { nome: [NOME_REPETIDO] } }
  return erroBD(erro)
}

function erroCampo(campo: string, mensagem: string): ResultadoAcao<never> {
  return { ok: false, erro: mensagem, campos: { [campo]: [mensagem] } }
}

/** Só as colunas da tabela consumiveis (o preço e o stock inicial ficam noutras tabelas). */
function colunasConsumivel(dados: DadosConsumivel) {
  return {
    nome: dados.nome,
    categoria: dados.categoria,
    unidade: dados.unidade,
    stock_minimo: dados.stock_minimo,
    notas: dados.notas,
    ativo: dados.ativo,
  }
}

/** Grava o preço (upsert) ou apaga-o quando fica em branco. */
async function gravarPreco(supabase: Supabase, consumivelId: string, preco: number | null) {
  const { error } =
    preco === null
      ? await supabase.from("consumiveis_precos").delete().eq("consumivel_id", consumivelId)
      : await supabase
          .from("consumiveis_precos")
          .upsert({ consumivel_id: consumivelId, preco_unitario: preco }, { onConflict: "consumivel_id" })
  return error
}

/** Stock atual de um consumível (soma dos movimentos); null se não existir. */
async function lerStock(supabase: Supabase, consumivelId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("stock_consumiveis").eq("consumivel_id", consumivelId).maybeSingle()
  if (error) console.error("Erro ao ler o stock:", error.code, error.message)
  return data ? Number(data.stock) : null
}

/** "Entrada registada. Stock atual: 250 m." */
async function comStock(supabase: Supabase, mensagem: string, consumivelId: string, unidade: string) {
  const stock = await lerStock(supabase, consumivelId)
  return stock === null ? mensagem : `${mensagem} Stock atual: ${formatarQuantidade(stock, unidade)}.`
}

/** Sem erros de vírgula flutuante (a BD guarda 3 casas). */
function arredondar(valor: number) {
  return Math.round(valor * 1000) / 1000
}

// ---------------------------------------------------------------------
// Consumíveis: criar, editar, desativar e apagar (só o gerente)
// ---------------------------------------------------------------------

export async function criarConsumivel(valores: CamposConsumivel): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const dados = esquemaConsumivel.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { preco_unitario: preco, stock_inicial: stockInicial } = dados.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("consumiveis")
    .insert({ ...colunasConsumivel(dados.data), ativo: true })
    .select("id")
    .single()
  if (error) return erroGravarConsumivel(error)

  // O preço e o stock inicial ficam noutras tabelas: se falharem, o consumível é desfeito.
  let problema = preco === null ? null : await gravarPreco(supabase, data.id, preco)
  if (!problema && stockInicial) {
    const { error: erroEntrada } = await supabase.from("movimentos_stock").insert({
      consumivel_id: data.id,
      tipo: "entrada",
      quantidade: stockInicial,
      data: hojeEmLisboa(),
      preco_unitario: preco,
      notas: "Stock inicial",
    })
    problema = erroEntrada
  }
  if (problema) {
    await supabase.from("consumiveis").delete().eq("id", data.id)
    return erroBD(problema)
  }

  revalidarConsumiveis()
  return { ok: true, mensagem: "Consumível criado.", redirecionar: `/recursos/consumiveis/${data.id}` }
}

export async function atualizarConsumivel(id: string, valores: CamposConsumivel): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const consumivelId = idObrigatorio.safeParse(id)
  if (!consumivelId.success) return NAO_EXISTE
  const dados = esquemaConsumivel.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("consumiveis")
    .select("id, unidade")
    .eq("id", consumivelId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE

  // Os movimentos (e os materiais dos trabalhos) estão na unidade atual.
  if (dados.data.unidade !== atual.unidade) {
    const { count, error } = await supabase
      .from("movimentos_stock")
      .select("id", { count: "exact", head: true })
      .eq("consumivel_id", atual.id)
    if (error) return erroBD(error)
    if (count) return erroCampo("unidade", UNIDADE_BLOQUEADA)
  }

  const { data: alterados, error } = await supabase
    .from("consumiveis")
    .update(colunasConsumivel(dados.data))
    .eq("id", atual.id)
    .select("id")
  if (error?.code === "23514" && dados.data.unidade !== atual.unidade) {
    // Entrou um movimento depois da verificação acima: a BD recusa mudar a unidade.
    revalidarConsumiveis()
    return erroCampo("unidade", UNIDADE_BLOQUEADA)
  }
  if (error) return erroGravarConsumivel(error)
  if (alterados.length === 0) return NAO_EXISTE

  const erroPreco = await gravarPreco(supabase, atual.id, dados.data.preco_unitario)
  revalidarConsumiveis()
  if (erroPreco) {
    console.error("Erro ao gravar o preço:", erroPreco.code, erroPreco.message)
    return { ok: false, erro: "Os dados foram guardados, mas não foi possível gravar o preço. Tente de novo." }
  }
  return { ok: true, mensagem: "Consumível guardado.", redirecionar: `/recursos/consumiveis/${atual.id}` }
}

/** Desativar (deixa de aparecer na escolha de materiais; o histórico mantém-se) ou reativar. */
export async function alterarEstadoConsumivel(id: string, ativo: boolean): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const pedido = z.object({ id: idObrigatorio, ativo: z.boolean() }).safeParse({ id, ativo })
  if (!pedido.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("consumiveis")
    .update({ ativo: pedido.data.ativo })
    .eq("id", pedido.data.id)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarConsumiveis()
  return { ok: true, mensagem: pedido.data.ativo ? "Consumível reativado." : "Consumível desativado." }
}

/** Só se apaga um consumível sem movimentos de stock (a BD recusa os outros). */
export async function apagarConsumivel(id: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const consumivelId = idObrigatorio.safeParse(id)
  if (!consumivelId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase.from("consumiveis").delete().eq("id", consumivelId.data).select("id")
  if (error) {
    // Ganhou movimentos entretanto: a ficha passa a mostrar o botão Desativar.
    if (error.code === "23503") revalidarConsumiveis()
    return erroBD(error, { emUso: COM_MOVIMENTOS })
  }
  if (data.length === 0) return NAO_EXISTE

  revalidarConsumiveis()
  return { ok: true, mensagem: "Consumível apagado.", redirecionar: "/recursos/consumiveis" }
}

// ---------------------------------------------------------------------
// Movimentos de stock (só o gerente)
// ---------------------------------------------------------------------

/** O consumível (com a unidade, para as mensagens) ou o erro a devolver. */
async function lerConsumivel(
  supabase: Supabase,
  id: string
): Promise<{ consumivel: { id: string; unidade: string } } | { erro: ResultadoAcao<never> }> {
  const consumivelId = idObrigatorio.safeParse(id)
  if (!consumivelId.success) return { erro: NAO_EXISTE }
  const { data, error } = await supabase
    .from("consumiveis")
    .select("id, unidade")
    .eq("id", consumivelId.data)
    .maybeSingle()
  if (error) return { erro: erroBD(error) }
  if (!data) return { erro: NAO_EXISTE }
  return { consumivel: data }
}

/** O trabalho escolhido tem de existir (a lista pode estar desatualizada). */
async function validarTrabalho(supabase: Supabase, trabalhoId: string | null): Promise<ResultadoAcao<never> | null> {
  if (!trabalhoId) return null
  const { data, error } = await supabase.from("trabalhos").select("id").eq("id", trabalhoId).maybeSingle()
  if (error) return erroBD(error)
  return data ? null : erroCampo("trabalho_id", TRABALHO_NAO_EXISTE)
}

export async function registarEntrada(consumivelId: string, valores: CamposEntrada): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const dados = esquemaEntrada.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const lido = await lerConsumivel(supabase, consumivelId)
  if ("erro" in lido) return lido.erro
  const { consumivel } = lido

  const { error } = await supabase.from("movimentos_stock").insert({
    consumivel_id: consumivel.id,
    tipo: "entrada",
    quantidade: dados.data.quantidade,
    data: dados.data.data,
    preco_unitario: dados.data.preco_unitario,
    notas: dados.data.notas,
  })
  if (error) return erroBD(error, JA_NAO_EXISTE)

  let mensagem = "Entrada registada."
  if (dados.data.atualizar_preco && dados.data.preco_unitario !== null) {
    const erroPreco = await gravarPreco(supabase, consumivel.id, dados.data.preco_unitario)
    if (erroPreco) {
      console.error("Erro ao gravar o preço:", erroPreco.code, erroPreco.message)
      mensagem = "Entrada registada, mas o preço do consumível não foi atualizado."
    } else {
      mensagem = "Entrada registada e preço atualizado."
    }
  }

  revalidarStock()
  return { ok: true, mensagem: await comStock(supabase, mensagem, consumivel.id, consumivel.unidade) }
}

export async function registarSaida(consumivelId: string, valores: CamposSaida): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const dados = esquemaSaida.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const lido = await lerConsumivel(supabase, consumivelId)
  if ("erro" in lido) return lido.erro
  const { consumivel } = lido
  const problema = await validarTrabalho(supabase, dados.data.trabalho_id)
  if (problema) return problema

  // As saídas gravam-se com quantidade negativa.
  const { error } = await supabase.from("movimentos_stock").insert({
    consumivel_id: consumivel.id,
    tipo: "saida",
    quantidade: -dados.data.quantidade,
    data: dados.data.data,
    trabalho_id: dados.data.trabalho_id,
    notas: dados.data.notas,
  })
  if (error) return erroBD(error, JA_NAO_EXISTE)

  revalidarStock()
  return { ok: true, mensagem: await comStock(supabase, "Saída registada.", consumivel.id, consumivel.unidade) }
}

/** Acerto de inventário: grava a diferença entre o stock contado e o da app. */
export async function registarAcerto(consumivelId: string, valores: CamposAcerto): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const dados = esquemaAcerto.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const lido = await lerConsumivel(supabase, consumivelId)
  if ("erro" in lido) return lido.erro
  const { consumivel } = lido

  const stock = await lerStock(supabase, consumivel.id)
  if (stock === null) return { ok: false, erro: "Não foi possível ler o stock atual. Tente de novo." }
  const diferenca = arredondar(dados.data.stock_contado - stock)
  if (diferenca === 0) return { ok: true, mensagem: "O stock já está certo." }

  const { error } = await supabase.from("movimentos_stock").insert({
    consumivel_id: consumivel.id,
    tipo: "ajuste",
    quantidade: diferenca,
    data: dados.data.data,
    notas: dados.data.notas,
  })
  if (error) return erroBD(error, JA_NAO_EXISTE)

  revalidarStock()
  const sinal = diferenca > 0 ? "+" : "−"
  return {
    ok: true,
    mensagem: await comStock(
      supabase,
      `Acerto registado (${sinal}${formatarQuantidade(Math.abs(diferenca), consumivel.unidade)}).`,
      consumivel.id,
      consumivel.unidade
    ),
  }
}

/**
 * Movimento feito à mão (as saídas dos materiais dos trabalhos são da BD),
 * do tipo esperado, com a unidade do consumível; ou o erro a devolver.
 */
async function lerMovimentoManual(
  supabase: Supabase,
  id: string,
  tipo?: TipoMovimentoStock
): Promise<{ movimento: { id: string; consumivelId: string; unidade: string } } | { erro: ResultadoAcao<never> }> {
  const movimentoId = idObrigatorio.safeParse(id)
  if (!movimentoId.success) return { erro: MOVIMENTO_NAO_EXISTE }
  const { data, error } = await supabase
    .from("movimentos_stock")
    .select("id, tipo, consumivel_id, registo_material_id, consumivel:consumiveis(unidade)")
    .eq("id", movimentoId.data)
    .maybeSingle()
  if (error) return { erro: erroBD(error) }
  if (!data || (tipo && data.tipo !== tipo)) return { erro: MOVIMENTO_NAO_EXISTE }
  if (data.registo_material_id) return { erro: DO_MATERIAL }
  return { movimento: { id: data.id, consumivelId: data.consumivel_id, unidade: data.consumivel?.unidade ?? "" } }
}

/** Grava as alterações de um movimento feito à mão (nunca os dos materiais). */
async function gravarMovimento(
  supabase: Supabase,
  movimento: { id: string; consumivelId: string; unidade: string },
  alteracoes: { quantidade: number; data: string; notas: string | null; preco_unitario?: number | null; trabalho_id?: string | null }
): Promise<ResultadoAcao> {
  const { data, error } = await supabase
    .from("movimentos_stock")
    .update(alteracoes)
    .eq("id", movimento.id)
    .is("registo_material_id", null)
    .select("id")
  if (error) return erroBD(error, JA_NAO_EXISTE)
  if (data.length === 0) return MOVIMENTO_NAO_EXISTE

  revalidarStock()
  return {
    ok: true,
    mensagem: await comStock(supabase, "Movimento guardado.", movimento.consumivelId, movimento.unidade),
  }
}

export async function atualizarEntrada(movimentoId: string, valores: CamposEntrada): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const dados = esquemaEntrada.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const lido = await lerMovimentoManual(supabase, movimentoId, "entrada")
  if ("erro" in lido) return lido.erro
  return gravarMovimento(supabase, lido.movimento, {
    quantidade: dados.data.quantidade,
    data: dados.data.data,
    preco_unitario: dados.data.preco_unitario,
    notas: dados.data.notas,
  })
}

export async function atualizarSaida(movimentoId: string, valores: CamposSaida): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const dados = esquemaSaida.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const lido = await lerMovimentoManual(supabase, movimentoId, "saida")
  if ("erro" in lido) return lido.erro
  const problema = await validarTrabalho(supabase, dados.data.trabalho_id)
  if (problema) return problema
  return gravarMovimento(supabase, lido.movimento, {
    quantidade: -dados.data.quantidade,
    data: dados.data.data,
    trabalho_id: dados.data.trabalho_id,
    notas: dados.data.notas,
  })
}

export async function atualizarAcerto(movimentoId: string, valores: CamposEditarAcerto): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const dados = esquemaEditarAcerto.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const lido = await lerMovimentoManual(supabase, movimentoId, "ajuste")
  if ("erro" in lido) return lido.erro
  return gravarMovimento(supabase, lido.movimento, {
    quantidade: dados.data.quantidade,
    data: dados.data.data,
    notas: dados.data.notas,
  })
}

export async function apagarMovimento(movimentoId: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const supabase = await createClient()
  const lido = await lerMovimentoManual(supabase, movimentoId)
  if ("erro" in lido) return lido.erro
  const { movimento } = lido

  const { data, error } = await supabase
    .from("movimentos_stock")
    .delete()
    .eq("id", movimento.id)
    .is("registo_material_id", null)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return MOVIMENTO_NAO_EXISTE

  revalidarStock()
  return {
    ok: true,
    mensagem: await comStock(supabase, "Movimento apagado.", movimento.consumivelId, movimento.unidade),
  }
}
