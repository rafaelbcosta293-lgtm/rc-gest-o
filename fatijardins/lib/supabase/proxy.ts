import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env"

/** Páginas que se podem abrir sem sessão iniciada. */
const ROTAS_PUBLICAS = ["/login", "/recuperar-palavra-passe", "/auth", "/offline"]

function eRotaPublica(caminho: string) {
  return ROTAS_PUBLICAS.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`))
}

/**
 * Renova a sessão do Supabase em cada pedido e envia para /login quem
 * não tem sessão. É só uma verificação rápida: as permissões reais são
 * verificadas na base de dados (RLS) e em lib/auth.ts.
 */
export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return response
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
        Object.entries(headers).forEach(([chave, valor]) => response.headers.set(chave, valor))
      },
    },
  })

  // Não pôr código entre createServerClient e getClaims: a renovação do
  // token acontece aqui.
  const { data } = await supabase.auth.getClaims()
  const temSessao = Boolean(data?.claims?.sub)
  const caminho = request.nextUrl.pathname

  // Server Actions (POST com o cabeçalho Next-Action) não são redirecionadas:
  // um 307 para /login partia a resposta da ação e o utilizador só via
  // "verifique a ligação". A própria ação verifica a sessão e responde.
  const eServerAction = request.method === "POST" && request.headers.has("next-action")

  if (!temSessao && !eRotaPublica(caminho) && !eServerAction) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    if (caminho !== "/") url.searchParams.set("seguinte", caminho + request.nextUrl.search)
    const redirecionar = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirecionar.cookies.set(cookie))
    return redirecionar
  }

  if (temSessao && caminho === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    const redirecionar = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirecionar.cookies.set(cookie))
    return redirecionar
  }

  return response
}
