import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { caminhoSeguro } from "@/lib/validacao/auth"

/**
 * Destino das ligações enviadas por email (recuperar palavra-passe, convites).
 * Aceita o formato com token_hash (recomendado, funciona em qualquer browser)
 * e o formato com ?code= (PKCE).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const tokenHash = url.searchParams.get("token_hash")
  const tipo = url.searchParams.get("type") as EmailOtpType | null
  const codigo = url.searchParams.get("code")
  const seguinte = caminhoSeguro(url.searchParams.get("seguinte") ?? url.searchParams.get("next"))

  const supabase = await createClient()
  let erro = true

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })
    erro = Boolean(error)
  } else if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo)
    erro = Boolean(error)
  }

  const destino = erro ? new URL("/login?erro=ligacao", url.origin) : new URL(seguinte, url.origin)
  return NextResponse.redirect(destino)
}
