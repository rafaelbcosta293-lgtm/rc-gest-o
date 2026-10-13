import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * Terminar sessão (só neste dispositivo). É um formulário normal (POST) e
 * não uma Server Action de propósito: a resposta recarrega a página inteira,
 * o que limpa o estado que o Next.js guarda das páginas visitadas
 * (formulários, dados) antes de outra pessoa usar o mesmo telemóvel.
 */
export async function POST(request: NextRequest) {
  // Recusar pedidos vindos de outros sites (compara com o anfitrião do pedido,
  // para funcionar também por IP na rede local ou atrás de um proxy).
  const origem = request.headers.get("origin")
  const anfitriao = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (origem && anfitriao && hostDe(origem) !== anfitriao) {
    return new NextResponse("Pedido recusado.", { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut({ scope: "local" })

  // Caminho relativo: o browser fica no mesmo endereço por onde abriu a app.
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } })
}

function hostDe(endereco: string) {
  try {
    return new URL(endereco).host
  } catch {
    return null
  }
}
