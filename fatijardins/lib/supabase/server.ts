import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, verificarVariaveisSupabase } from "@/lib/env"
import type { Database } from "./database.types"

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do utilizador (cookies), por isso todas as consultas passam
 * pela RLS com as permissões do perfil dele.
 * Crie um cliente novo em cada pedido; não o guarde em variáveis globais.
 *
 * O connection() garante que as consultas só correm num pedido real do
 * utilizador (nunca no pré-render/prefetch), porque o cliente compara a
 * validade do token com a hora atual e os dados têm de estar sempre frescos.
 */
export async function createClient() {
  verificarVariaveisSupabase()
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado a partir de um Server Component, onde não se podem gravar
          // cookies. Não faz mal: o proxy.ts renova a sessão em cada pedido.
        }
      },
    },
  })
}
