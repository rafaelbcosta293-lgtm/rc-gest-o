"use server"

import { revalidatePath } from "next/cache"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao } from "@/lib/auth"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import type { TablesUpdate } from "@/lib/supabase/database.types"
import { esquemaEmpresa, type CamposEmpresa } from "@/lib/validacao/empresa"

/** Só o gerente altera os dados da empresa (a RLS também o exige). */
export async function guardarEmpresa(valores: CamposEmpresa): Promise<ResultadoAcao> {
  const sessao = await obterSessao()
  if (!eGerente(sessao?.colaborador.perfil)) return SEM_PERMISSAO

  const dados = esquemaEmpresa.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  // Só as colunas que a BD deixa alterar (GRANT por coluna).
  const alteracoes: TablesUpdate<"empresa"> = dados.data
  const supabase = await createClient()
  const { data, error } = await supabase.from("empresa").update(alteracoes).eq("id", true).select("id")
  if (error) return erroBD(error)
  if (data.length === 0) return SEM_PERMISSAO

  // A validade e as condições propostas aparecem no formulário dos orçamentos novos.
  revalidatePath("/empresa")
  revalidatePath("/orcamentos", "layout")
  return { ok: true, mensagem: "Dados da empresa guardados." }
}
