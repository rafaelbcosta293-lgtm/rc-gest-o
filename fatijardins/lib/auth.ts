import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { isAuthRetryableFetchError } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import type { Perfil } from "@/lib/perfis"

export type Sessao = {
  userId: string
  email: string | null
  colaborador: {
    id: string
    nome: string
    perfil: Perfil
    funcao: string | null
    equipaId: string | null
  }
}

type EstadoSessao =
  | { estado: "sem_sessao" }
  | { estado: "sem_acesso"; userId: string; email: string | null }
  | { estado: "ok"; sessao: Sessao }

/**
 * Lê a sessão e o colaborador associado (uma vez por pedido).
 * O utilizador só tem acesso se estiver ligado a um colaborador ativo.
 */
const lerSessao = cache(async (): Promise<EstadoSessao> => {
  const supabase = await createClient()
  const { data, error: erroSessao } = await supabase.auth.getClaims()
  // Falha de rede/servidor: mostrar o erro ("Tentar de novo") em vez de
  // mandar a pessoa para o login como se não tivesse sessão.
  if (erroSessao && isAuthRetryableFetchError(erroSessao)) {
    throw new Error("Não foi possível verificar a sessão.")
  }
  const claims = data?.claims
  if (!claims?.sub) return { estado: "sem_sessao" }

  const email = typeof claims.email === "string" ? claims.email : null
  const { data: colaborador, error } = await supabase
    .from("colaboradores")
    .select("id, nome, perfil, funcao, equipa_id")
    .eq("user_id", claims.sub)
    .eq("ativo", true)
    .maybeSingle()

  // Uma falha da base de dados não pode ser confundida com "sem acesso".
  if (error) throw new Error(`Não foi possível verificar o acesso: ${error.message}`)
  if (!colaborador) return { estado: "sem_acesso", userId: claims.sub, email }

  return {
    estado: "ok",
    sessao: {
      userId: claims.sub,
      email,
      colaborador: {
        id: colaborador.id,
        nome: colaborador.nome,
        perfil: colaborador.perfil,
        funcao: colaborador.funcao,
        equipaId: colaborador.equipa_id,
      },
    },
  }
})

/** Devolve a sessão ou null (para Server Actions, que devolvem um erro em vez de redirecionar). */
export async function obterSessao(): Promise<Sessao | null> {
  const estado = await lerSessao()
  return estado.estado === "ok" ? estado.sessao : null
}

/** Para páginas: exige sessão com colaborador ativo; caso contrário redireciona. */
export async function exigirSessao(): Promise<Sessao> {
  const estado = await lerSessao()
  if (estado.estado === "sem_sessao") redirect("/login")
  if (estado.estado === "sem_acesso") redirect("/sem-acesso")
  return estado.sessao
}

/** Para páginas: exige um dos perfis indicados. */
export async function exigirPerfil(...perfis: Perfil[]): Promise<Sessao> {
  const sessao = await exigirSessao()
  if (!perfis.includes(sessao.colaborador.perfil)) redirect("/sem-permissao")
  return sessao
}

/** Para a página /sem-acesso: sabe se há sessão sem colaborador associado. */
export async function obterEstadoSessao() {
  return lerSessao()
}
