import type { NextRequest } from "next/server"

import { atualizarSessao } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return atualizarSessao(request)
}

export const config = {
  matcher: [
    // Tudo exceto ficheiros estáticos, imagens, ícones, manifest e service worker.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
}
