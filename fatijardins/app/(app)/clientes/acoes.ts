"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao } from "@/lib/auth"
import { eGerente, eGerenteOuChefe } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaCliente,
  esquemaLocal,
  type CamposCliente,
  type CamposLocal,
} from "@/lib/validacao/clientes"

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O registo não existe ou não tem acesso a ele.",
}

const NIF_DUPLICADO = "Já existe um cliente com este NIF."

const MENSAGENS_CLIENTE = {
  emUso:
    "Não é possível apagar este cliente porque tem registos associados (trabalhos, orçamentos ou pagamentos). Pode desativá-lo.",
}

const MENSAGENS_LOCAL = {
  emUso: "Não é possível apagar este local porque tem registos associados. Pode desativá-lo.",
}

/** Gerente ou chefe de equipa (quem pode ver, criar e alterar clientes e locais). */
async function podeGerirClientes() {
  const sessao = await obterSessao()
  return eGerenteOuChefe(sessao?.colaborador.perfil)
}

/** Só o gerente pode apagar clientes e locais. */
async function podeApagar() {
  const sessao = await obterSessao()
  return eGerente(sessao?.colaborador.perfil)
}

/** Atualiza a lista, as fichas e os formulários de clientes e o Início (contadores). */
function revalidarClientes() {
  revalidatePath("/clientes", "layout")
  revalidatePath("/")
}

/** O NIF duplicado também é mostrado no próprio campo. */
function erroGravarCliente(erro: PostgrestError): ResultadoAcao<never> {
  if (erro.code === "23505") return { ok: false, erro: NIF_DUPLICADO, campos: { nif: [NIF_DUPLICADO] } }
  return erroBD(erro, MENSAGENS_CLIENTE)
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------

export async function criarCliente(valores: CamposCliente): Promise<ResultadoAcao> {
  if (!(await podeGerirClientes())) return SEM_PERMISSAO

  const dados = esquemaCliente.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const linha: TablesInsert<"clientes"> = { ...dados.data, ativo: true }
  const supabase = await createClient()
  const { data, error } = await supabase.from("clientes").insert(linha).select("id").single()
  if (error) return erroGravarCliente(error)

  revalidarClientes()
  return { ok: true, mensagem: "Cliente criado.", redirecionar: `/clientes/${data.id}` }
}

export async function atualizarCliente(id: string, valores: CamposCliente): Promise<ResultadoAcao> {
  if (!(await podeGerirClientes())) return SEM_PERMISSAO

  const clienteId = idObrigatorio.safeParse(id)
  if (!clienteId.success) return NAO_EXISTE
  const dados = esquemaCliente.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const alteracoes: TablesUpdate<"clientes"> = dados.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clientes")
    .update(alteracoes)
    .eq("id", clienteId.data)
    .select("id")
  if (error) return erroGravarCliente(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarClientes()
  return { ok: true, mensagem: "Cliente guardado.", redirecionar: `/clientes/${clienteId.data}` }
}

export async function alterarEstadoCliente(id: string, ativo: boolean): Promise<ResultadoAcao> {
  if (!(await podeGerirClientes())) return SEM_PERMISSAO

  const dados = z.object({ id: idObrigatorio, ativo: z.boolean() }).safeParse({ id, ativo })
  if (!dados.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clientes")
    .update({ ativo: dados.data.ativo })
    .eq("id", dados.data.id)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarClientes()
  return { ok: true, mensagem: dados.data.ativo ? "Cliente reativado." : "Cliente desativado." }
}

export async function apagarCliente(id: string): Promise<ResultadoAcao> {
  if (!(await podeApagar())) return SEM_PERMISSAO

  const clienteId = idObrigatorio.safeParse(id)
  if (!clienteId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase.from("clientes").delete().eq("id", clienteId.data).select("id")
  if (error) return erroBD(error, MENSAGENS_CLIENTE)
  if (data.length === 0) return NAO_EXISTE

  revalidarClientes()
  return { ok: true, mensagem: "Cliente apagado.", redirecionar: "/clientes" }
}

// ---------------------------------------------------------------------
// Locais
// ---------------------------------------------------------------------

export async function criarLocal(clienteId: string, valores: CamposLocal): Promise<ResultadoAcao> {
  if (!(await podeGerirClientes())) return SEM_PERMISSAO

  const cliente = idObrigatorio.safeParse(clienteId)
  if (!cliente.success) return NAO_EXISTE
  const dados = esquemaLocal.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const linha: TablesInsert<"locais"> = { ...dados.data, ativo: true, cliente_id: cliente.data }
  const supabase = await createClient()
  const { error } = await supabase.from("locais").insert(linha)
  // 23503 ao criar: o cliente já não existe.
  if (error) return erroBD(error, { emUso: "O cliente já não existe ou foi apagado." })

  revalidarClientes()
  return { ok: true, mensagem: "Local criado.", redirecionar: `/clientes/${cliente.data}` }
}

export async function atualizarLocal(
  clienteId: string,
  localId: string,
  valores: CamposLocal
): Promise<ResultadoAcao> {
  if (!(await podeGerirClientes())) return SEM_PERMISSAO

  const ids = z.object({ clienteId: idObrigatorio, localId: idObrigatorio }).safeParse({ clienteId, localId })
  if (!ids.success) return NAO_EXISTE
  const dados = esquemaLocal.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const alteracoes: TablesUpdate<"locais"> = dados.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("locais")
    .update(alteracoes)
    .eq("id", ids.data.localId)
    .eq("cliente_id", ids.data.clienteId)
    .select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarClientes()
  return { ok: true, mensagem: "Local guardado.", redirecionar: `/clientes/${ids.data.clienteId}` }
}

export async function apagarLocal(clienteId: string, localId: string): Promise<ResultadoAcao> {
  if (!(await podeApagar())) return SEM_PERMISSAO

  const ids = z.object({ clienteId: idObrigatorio, localId: idObrigatorio }).safeParse({ clienteId, localId })
  if (!ids.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("locais")
    .delete()
    .eq("id", ids.data.localId)
    .eq("cliente_id", ids.data.clienteId)
    .select("id")
  if (error) return erroBD(error, MENSAGENS_LOCAL)
  if (data.length === 0) return NAO_EXISTE

  revalidarClientes()
  return { ok: true, mensagem: "Local apagado.", redirecionar: `/clientes/${ids.data.clienteId}` }
}
