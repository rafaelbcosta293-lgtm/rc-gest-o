import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"

/** Resultado devolvido pelas Server Actions aos formulários. */
export type ResultadoAcao<T = undefined> =
  | { ok: true; dados?: T; mensagem?: string; redirecionar?: string }
  | { ok: false; erro: string; campos?: Record<string, string[] | undefined> }

export const SEM_PERMISSAO: ResultadoAcao<never> = {
  ok: false,
  erro: "Não tem permissão para esta ação.",
}

export function erroValidacao(erro: z.ZodError): ResultadoAcao<never> {
  return {
    ok: false,
    erro: "Verifique os campos assinalados.",
    campos: z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>,
  }
}

/** Traduz erros do Postgres/PostgREST para mensagens claras em português. */
export function mensagemErroBD(
  erro: Pick<PostgrestError, "code" | "message"> | null | undefined,
  mensagens: { duplicado?: string; emUso?: string } = {}
): string {
  switch (erro?.code) {
    case "23505":
      return mensagens.duplicado ?? "Já existe um registo com estes dados."
    case "23503":
      return mensagens.emUso ?? "Não é possível concluir: existem registos associados."
    case "23514":
      return erro.message.startsWith("Tem de existir")
        ? erro.message
        : "Algum dos valores não é válido."
    case "42501":
      return "Não tem permissão para esta ação."
    case "PGRST116":
      return "O registo não existe ou não tem acesso a ele."
    default:
      return "Ocorreu um erro inesperado. Tente novamente."
  }
}

export function erroBD(
  erro: Pick<PostgrestError, "code" | "message"> | null | undefined,
  mensagens?: { duplicado?: string; emUso?: string }
): ResultadoAcao<never> {
  if (erro) console.error("Erro da base de dados:", erro.code, erro.message)
  return { ok: false, erro: mensagemErroBD(erro, mensagens) }
}
