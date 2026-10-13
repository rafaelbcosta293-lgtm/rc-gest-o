import { createBrowserClient } from "@supabase/ssr"

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, verificarVariaveisSupabase } from "@/lib/env"
import type { Database } from "./database.types"

/** Cliente Supabase para Client Components (browser). */
export function createClient() {
  verificarVariaveisSupabase()
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
}
