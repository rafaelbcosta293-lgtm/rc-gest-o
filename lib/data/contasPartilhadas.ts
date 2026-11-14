import { createAdminClient } from '@/lib/supabase/admin'
import { ehContaPartilhada } from './acessos'

// As contas partilhadas do negócio (Coordenação, RC Fátima, RC Leiria)
// têm ficha em "perfis" e estão ligadas a estúdios — é isso que lhes dá
// acesso aos dados — mas não são pessoas: não dão treinos nem fazem
// avaliações, por isso não devem aparecer para escolher como instrutor.
// Só se sabe quais são pelo email, que vive no Auth; como quase nunca
// mudam, a lista fica em memória uns minutos em vez de se perguntar ao
// Auth em cada página.
const VALIDADE_MS = 5 * 60 * 1000
let guardado: { ids: Set<string>; ate: number } | null = null

export async function idsContasPartilhadas(): Promise<Set<string>> {
  if (guardado && guardado.ate > Date.now()) return guardado.ids
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw new Error(error.message)
    const ids = new Set(data.users.filter((u) => ehContaPartilhada(u.email ?? null)).map((u) => u.id))
    guardado = { ids, ate: Date.now() + VALIDADE_MS }
    return ids
  } catch {
    // Sem conseguir saber quais são, mostra-se a equipa toda como
    // antes — nunca se parte uma página por causa disto.
    return guardado?.ids ?? new Set()
  }
}
