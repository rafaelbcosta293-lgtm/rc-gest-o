import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { caminhoSeguro } from "@/lib/validacao/auth"

/**
 * Destino das ligações de recuperação de palavra-passe enviadas por email.
 * Aceita o formato com token_hash (recomendado, funciona em qualquer browser)
 * e o formato com ?code= (PKCE). Só aceita ligações do tipo "recovery": as
 * contas são criadas pelo gerente, não há convites nem registo por email.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const tokenHash = url.searchParams.get("token_hash")
  const tipo = url.searchParams.get("type")
  const codigo = url.searchParams.get("code")
  const seguinte = caminhoSeguro(url.searchParams.get("seguinte") ?? url.searchParams.get("next"))

  const supabase = await createClient()
  let erro = true

  if (tokenHash && tipo === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
    erro = Boolean(error)
  } else if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo)
    erro = Boolean(error)
  }

  const destino = erro ? new URL("/login?erro=ligacao", url.origin) : new URL(seguinte, url.origin)
  return NextResponse.redirect(destino)
}
