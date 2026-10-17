"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

import { erroBD, erroValidacao, mensagemErroBD, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao } from "@/lib/auth"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaCobranca,
  esquemaEditarCobranca,
  esquemaPagamento,
  type CamposCobranca,
  type CamposEditarCobranca,
  type CamposPagamento,
} from "@/lib/validacao/cobrancas"

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "A cobrança não existe ou não tem acesso a ela.",
}

const PAGAMENTO_NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O pagamento já não existe. Atualize a página.",
}

const COM_PAGAMENTOS = "Esta cobrança já tem pagamentos: apague-os primeiro."
const ORCAMENTO_NAO_ACEITE = "Só se cria uma cobrança de um orçamento aceite."

/** Tudo o que é dinheiro é só do gerente (a RLS também o garante). */
async function sessaoGerente(): Promise<boolean> {
  const sessao = await obterSessao()
  return eGerente(sessao?.colaborador.perfil)
}

/** Listas e fichas das finanças, a ficha do cliente, a do orçamento e o Início. */
function revalidarFinancas() {
  revalidatePath("/financas", "layout")
  revalidatePath("/clientes/[id]", "page")
  revalidatePath("/orcamentos/[id]", "page")
  revalidatePath("/")
}

/** As regras da BD sobre valores (23514) já trazem a mensagem em português: mostra-se no campo do valor. */
function erroValor(erro: PostgrestError, mensagens?: { emUso?: string }): ResultadoAcao<never> {
  if (erro.code === "23514") {
    const mensagem = mensagemErroBD(erro)
    console.error("Erro da base de dados:", erro.code, erro.message)
    return { ok: false, erro: mensagem, campos: { valor: [mensagem] } }
  }
  return erroBD(erro, mensagens)
}

// ---------------------------------------------------------------------
// Cobranças
// ---------------------------------------------------------------------

export async function criarCobranca(valores: CamposCobranca): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const dados = esquemaCobranca.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { cliente_id, local_id, orcamento_id, ...resto } = dados.data

  const supabase = await createClient()
  // Do orçamento: tem de estar aceite; o cliente e o local vêm dele (trigger).
  if (orcamento_id) {
    const { data: orcamento, error } = await supabase
      .from("orcamentos")
      .select("id, estado")
      .eq("id", orcamento_id)
      .maybeSingle()
    if (error) return erroBD(error)
    if (!orcamento || orcamento.estado !== "aceite") return { ok: false, erro: ORCAMENTO_NAO_ACEITE }
  }

  const { data, error } = await supabase
    .from("cobrancas")
    .insert(
      orcamento_id
        ? { ...resto, origem: "orcamento", orcamento_id, cliente_id }
        : { ...resto, origem: "avulsa", cliente_id, local_id }
    )
    .select("id")
    .single()
  if (error) return erroValor(error, { emUso: "O cliente, o local ou o orçamento já não existem. Atualize a página." })

  revalidarFinancas()
  return { ok: true, mensagem: "Cobrança criada.", redirecionar: `/financas/cobrancas/${data.id}` }
}

export async function atualizarCobranca(id: string, valores: CamposEditarCobranca): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const cobrancaId = idObrigatorio.safeParse(id)
  if (!cobrancaId.success) return NAO_EXISTE
  const dados = esquemaEditarCobranca.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { data, error } = await supabase.from("cobrancas").update(dados.data).eq("id", cobrancaId.data).select("id")
  if (error) return erroValor(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarFinancas()
  return { ok: true, mensagem: "Cobrança guardada.", redirecionar: `/financas/cobrancas/${cobrancaId.data}` }
}

/** Só se apaga uma cobrança sem pagamentos (a BD recusa as outras). */
export async function apagarCobranca(id: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const cobrancaId = idObrigatorio.safeParse(id)
  if (!cobrancaId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase.from("cobrancas").delete().eq("id", cobrancaId.data).select("id")
  if (error) {
    // Recebeu pagamentos entretanto: a ficha deixa de mostrar o botão.
    if (error.code === "23503") revalidarFinancas()
    return erroBD(error, { emUso: COM_PAGAMENTOS })
  }
  if (data.length === 0) return NAO_EXISTE

  revalidarFinancas()
  return { ok: true, mensagem: "Cobrança apagada.", redirecionar: "/financas/cobrancas" }
}

// ---------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------

export async function registarPagamento(cobrancaId: string, valores: CamposPagamento): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const id = idObrigatorio.safeParse(cobrancaId)
  if (!id.success) return NAO_EXISTE
  const dados = esquemaPagamento.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { error } = await supabase.from("pagamentos").insert({ ...dados.data, cobranca_id: id.data })
  if (error) return erroValor(error, { emUso: "A cobrança já não existe. Atualize a página." })

  revalidarFinancas()
  return { ok: true, mensagem: "Pagamento registado." }
}

export async function atualizarPagamento(id: string, valores: CamposPagamento): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const pagamentoId = idObrigatorio.safeParse(id)
  if (!pagamentoId.success) return PAGAMENTO_NAO_EXISTE
  const dados = esquemaPagamento.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { data, error } = await supabase.from("pagamentos").update(dados.data).eq("id", pagamentoId.data).select("id")
  if (error) return erroValor(error)
  if (data.length === 0) return PAGAMENTO_NAO_EXISTE

  revalidarFinancas()
  return { ok: true, mensagem: "Pagamento guardado." }
}

export async function apagarPagamento(id: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  const pagamentoId = idObrigatorio.safeParse(id)
  if (!pagamentoId.success) return PAGAMENTO_NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase.from("pagamentos").delete().eq("id", pagamentoId.data).select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return PAGAMENTO_NAO_EXISTE

  revalidarFinancas()
  return { ok: true, mensagem: "Pagamento apagado." }
}
