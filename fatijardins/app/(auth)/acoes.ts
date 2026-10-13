"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { erroValidacao, type ResultadoAcao } from "@/lib/acoes"
import { createClient } from "@/lib/supabase/server"
import {
  caminhoSeguro,
  esquemaLogin,
  esquemaNovaPalavraPasse,
  esquemaRecuperar,
  type CamposLogin,
  type CamposNovaPalavraPasse,
  type CamposRecuperar,
} from "@/lib/validacao/auth"

const ERRO_LIGACAO = "Não foi possível contactar o servidor. Tente novamente."

export async function iniciarSessao(
  valores: CamposLogin,
  seguinte?: string | null
): Promise<ResultadoAcao> {
  const dados = esquemaLogin.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.palavraPasse,
  })

  if (error) {
    if (error.code === "invalid_credentials") {
      return { ok: false, erro: "Email ou palavra-passe incorretos." }
    }
    if (error.code === "email_not_confirmed") {
      return { ok: false, erro: "O email ainda não foi confirmado." }
    }
    if (error.status === 429) {
      return { ok: false, erro: "Demasiadas tentativas. Aguarde um pouco e tente de novo." }
    }
    console.error("Erro no login:", error.code, error.message)
    return { ok: false, erro: ERRO_LIGACAO }
  }

  return { ok: true, mensagem: "Sessão iniciada.", redirecionar: caminhoSeguro(seguinte) }
}

async function obterOrigem() {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL
  if (configurada) return configurada.replace(/\/$/, "")
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const protocolo = h.get("x-forwarded-proto") ?? "https"
  return `${protocolo}://${host}`
}

export async function pedirRecuperacao(valores: CamposRecuperar): Promise<ResultadoAcao> {
  const dados = esquemaRecuperar.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const origem = await obterOrigem()
  const { error } = await supabase.auth.resetPasswordForEmail(dados.data.email, {
    redirectTo: `${origem}/auth/confirm?seguinte=/atualizar-palavra-passe`,
  })

  if (error) {
    if (error.status === 429) {
      return { ok: false, erro: "Já pediu há pouco tempo. Aguarde alguns minutos e tente de novo." }
    }
    console.error("Erro ao pedir recuperação:", error.code, error.message)
  }

  // A resposta é igual exista ou não a conta, para não revelar emails.
  return {
    ok: true,
    mensagem: "Se existir uma conta com este email, vai receber uma ligação para definir uma nova palavra-passe.",
  }
}

export async function atualizarPalavraPasse(
  valores: CamposNovaPalavraPasse
): Promise<ResultadoAcao> {
  const dados = esquemaNovaPalavraPasse.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) {
    return { ok: false, erro: "A sessão expirou. Peça uma nova ligação de recuperação." }
  }

  const { error } = await supabase.auth.updateUser({ password: dados.data.palavraPasse })
  if (error) {
    if (error.code === "same_password") {
      return { ok: true, mensagem: "A palavra-passe foi guardada.", redirecionar: "/" }
    }
    if (error.code === "weak_password") {
      return {
        ok: false,
        erro: "Palavra-passe demasiado fraca. Use letras, números e símbolos.",
        campos: { palavraPasse: ["Palavra-passe demasiado fraca."] },
      }
    }
    console.error("Erro ao mudar a palavra-passe:", error.code, error.message)
    return { ok: false, erro: ERRO_LIGACAO }
  }

  return { ok: true, mensagem: "A palavra-passe foi alterada.", redirecionar: "/" }
}

export async function terminarSessao() {
  const supabase = await createClient()
  // Só este dispositivo: sair no telemóvel não deve terminar a sessão no PC.
  await supabase.auth.signOut({ scope: "local" })
  redirect("/login")
}
