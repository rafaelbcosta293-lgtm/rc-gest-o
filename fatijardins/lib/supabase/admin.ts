import "server-only"

import { createClient as criarClienteSupabase } from "@supabase/supabase-js"

import { SUPABASE_URL } from "@/lib/env"
import type { Database } from "./database.types"

/**
 * Cliente com a chave secreta (service role): ignora a RLS.
 * Usar APENAS no servidor e só para operações de administração de contas
 * (criar acessos, repor palavras-passe), depois de confirmar que quem pede
 * é gerente. Devolve null se a chave não estiver configurada.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !chave) return null

  return criarClienteSupabase<Database>(SUPABASE_URL, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
