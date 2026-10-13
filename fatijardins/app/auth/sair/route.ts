import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * Terminar sessão (só neste dispositivo). É um formulário normal (POST) e
 * não uma Server Action de propósito: a resposta recarrega a página inteira,
 * o que limpa o estado que o Next.js guarda das páginas visitadas
 * (formulários, dados) antes de outra pessoa usar o mesmo telemóvel.
 */
export async function POST(request: NextRequest) {
  const origem = request.headers.get("origin")
  if (origem && origem !== request.nextUrl.origin) {
    return new NextResponse("Pedido recusado.", { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut({ scope: "local" })

  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 })
}
